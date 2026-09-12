import { NextResponse } from 'next/server';
import {
  ADMIN_TOKEN_HEADER,
  assertOfficer,
  getAdminClient,
  readAdminEnv,
} from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The exact destructive statement this endpoint performs. Kept as a constant so
// the operation is auditable and cannot drift silently.
const TRUNCATE_STATEMENT =
  'TRUNCATE TABLE officer_audit_logs, anomaly_signals, projects CASCADE;';

/**
 * POST /api/admin/reset-db
 *
 * Purges the mock / staged audit tables so the platform can be reset to a clean
 * production baseline before a fresh MoSPI ingest.
 *
 * Security: requires the officer admin token (see assertOfficer). Fails closed
 * when ADMIN_API_TOKEN is not configured.
 *
 * Strategy:
 *   1. Prefer the `purge_audit_tables()` RPC (schema.sql, SECURITY DEFINER).
 *   2. Fall back to a direct `TRUNCATE ... CASCADE` via PostgREST RPC-less path
 *      is not available, so the fallback issues the truncate through the
 *      Postgres connection exposed by Supabase's `rpc` if present; otherwise we
 *      attempt scoped DELETEs as a last resort so the endpoint still works on
 *      databases created before schema.sql was applied.
 */
export async function POST(req: Request) {
  const auth = assertOfficer(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Server is missing SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL). Configure it to enable database purge.',
      },
      { status: 503 },
    );
  }

  // ---- Primary path: schema.sql RPC -----------------------------------------
  const rpc = await admin.rpc('purge_audit_tables');

  if (!rpc.error) {
    return NextResponse.json({
      ok: true,
      strategy: 'rpc:purge_audit_tables',
      statement: TRUNCATE_STATEMENT,
      purged: ['officer_audit_logs', 'anomaly_signals', 'projects'],
      message: 'Database purged and schema reset to a clean baseline.',
      environment: describeEnv(),
      at: new Date().toISOString(),
    });
  }

  const rpcMissing = /function|does not exist|schema cache|not find/i.test(
    rpc.error.message || '',
  );

  // ---- Fallback: targeted DELETEs (order respects FK dependencies) -----------
  // Used only when schema.sql has not been applied yet on this project.
  const deleted: Record<string, number | null> = {};
  const errors: string[] = [];
  for (const table of ['officer_audit_logs', 'anomaly_signals', 'projects']) {
    // Delete every row: a filter that is always true keeps PostgREST happy
    // (it refuses unfiltered deletes).
    const res = await admin.from(table).delete().not('id', 'is', null).select('id');
    if (res.error) {
      errors.push(`${table}: ${res.error.message}`);
      deleted[table] = null;
    } else {
      deleted[table] = res.data?.length ?? 0;
    }
  }

  if (errors.length === 0) {
    return NextResponse.json({
      ok: true,
      strategy: 'fallback:scoped-delete',
      statement: TRUNCATE_STATEMENT,
      purged: Object.keys(deleted),
      deleted,
      message: 'Database purged via scoped deletes (schema.sql RPC unavailable).',
      environment: describeEnv(),
      at: new Date().toISOString(),
    });
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'Database purge failed.',
      rpc_error: rpc.error.message,
      rpc_missing_function: rpcMissing,
      fallback_errors: errors,
      hint: 'Apply src/lib/schema.sql in the Supabase SQL editor to install purge_audit_tables().',
    },
    { status: 500 },
  );
}

/** OPTIONS handler so the browser preflight for the admin header succeeds. */
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': `Content-Type, ${ADMIN_TOKEN_HEADER}, Authorization`,
    },
  });
}

function describeEnv() {
  const env = readAdminEnv();
  const url = env?.url || '';
  // Never echo the key. Only surface a redacted project ref for operator clarity.
  const ref = url ? url.replace(/^https?:\/\//, '').split('.')[0] : 'unconfigured';
  return { supabase_project_ref: ref, service_role_configured: Boolean(env) };
}
