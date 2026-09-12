import { NextResponse } from 'next/server';
import {
  ADMIN_TOKEN_HEADER,
  assertOfficer,
  getAdminClient,
  readAdminEnv,
} from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The four tables this endpoint empties. Listed explicitly (rather than relying
 * on CASCADE discovery) so the purge scope is auditable at a glance.
 */
const PURGE_TABLES = [
  'officer_audit_logs',
  'anomaly_signals',
  'projects',
  'statutory_reports',
] as const;

/**
 * Columns probed to report a post-purge record count. Each table is counted via
 * a head request against a real column so PostgREST can serve it cheaply.
 */
const COUNT_PROBE_COLUMNS: Record<string, string> = {
  projects: 'work_id',
  anomaly_signals: 'id',
  officer_audit_logs: 'id',
  statutory_reports: 'id',
};

/**
 * POST /api/admin/purge-db
 *
 * Complete reset of every MPLAD Radar table in Supabase:
 *   • deletes all rows from projects, anomaly_signals, officer_audit_logs and
 *     statutory_reports
 *   • resets any identity sequences owned by those tables
 *   • returns the remaining record count so the caller can confirm "0 records"
 *
 * Security: requires the officer admin token (see assertOfficer) and fails
 * CLOSED when ADMIN_API_TOKEN is not configured, so an unconfigured deployment
 * can never expose an unauthenticated destructive endpoint.
 *
 * Strategy:
 *   1. Preferred: `purge_all_tables()` RPC (schema.sql §7) — a single
 *      `TRUNCATE ... RESTART IDENTITY CASCADE` inside a SECURITY DEFINER
 *      function. This is atomic and resets sequences.
 *   2. Fallback: scoped DELETEs per table, in FK-dependency order, for
 *      databases created before schema.sql was applied.
 */
export async function POST(req: Request) {
  // ---- 1. Authorize -------------------------------------------------------
  const auth = assertOfficer(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Server is missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_URL). Configure it to enable the database purge.',
      },
      { status: 503 },
    );
  }

  // ---- 2. Preferred path: TRUNCATE ... RESTART IDENTITY CASCADE -----------
  const rpc = await admin.rpc('purge_all_tables');
  let strategy = 'rpc:purge_all_tables';
  const errors: string[] = [];

  if (rpc.error) {
    // The function may be absent on databases that predate schema.sql §7.
    const missingFunction = /could not find|does not exist|schema cache/i.test(
      rpc.error.message || '',
    );

    // ---- 3. Fallback: scoped DELETEs (FK-safe order) ---------------------
    const deleted: Record<string, number | null> = {};
    for (const table of PURGE_TABLES) {
      // PostgREST refuses an unfiltered delete, so use an always-true filter
      // keyed on the table's primary column.
      const probe = COUNT_PROBE_COLUMNS[table] || 'id';
      const res = await admin.from(table).delete().not(probe, 'is', null).select(probe);

      if (res.error) {
        // A missing table is not fatal for a purge — record and continue.
        if (/does not exist|Could not find the table/i.test(res.error.message || '')) {
          deleted[table] = null;
          continue;
        }
        errors.push(`${table}: ${res.error.message}`);
        deleted[table] = null;
      } else {
        deleted[table] = res.data?.length ?? 0;
      }
    }

    strategy = missingFunction
      ? 'fallback:scoped-delete'
      : 'fallback:scoped-delete (rpc errored)';

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database purge failed.',
          rpc_error: rpc.error.message,
          fallback_errors: errors,
          hint: 'Apply src/lib/schema.sql in the Supabase SQL editor to install purge_all_tables().',
        },
        { status: 500 },
      );
    }

    // Confirm the reset by counting rows back.
    const remaining = await countRemaining(admin);

    return NextResponse.json(
      {
        success: true,
        message: `All database tables successfully purged. ${remaining} records remaining.`,
        strategy,
        purged: [...PURGE_TABLES],
        deleted,
        remaining_records: remaining,
        sequences_reset: false,
        note: 'purge_all_tables() unavailable — rows deleted directly; identity sequences were not reset.',
        environment: describeEnv(),
        at: new Date().toISOString(),
      },
      { status: 200 },
    );
  }

  // ---- 4. Confirm the reset ----------------------------------------------
  // TRUNCATE ... RESTART IDENTITY CASCADE is atomic, so a successful RPC means
  // every table is empty. We still count to return a verifiable number.
  const remaining = await countRemaining(admin);

  return NextResponse.json(
    {
      success: true,
      message: `All database tables successfully purged. ${remaining} records remaining.`,
      strategy,
      statement:
        'TRUNCATE TABLE officer_audit_logs, anomaly_signals, projects, statutory_reports RESTART IDENTITY CASCADE;',
      purged: [...PURGE_TABLES],
      remaining_records: remaining,
      sequences_reset: true,
      environment: describeEnv(),
      at: new Date().toISOString(),
    },
    { status: 200 },
  );
}

/** Sums the row counts of all four tables. */
async function countRemaining(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
): Promise<number> {
  let total = 0;

  for (const table of PURGE_TABLES) {
    const probe = COUNT_PROBE_COLUMNS[table] || 'id';
    const res = await admin.from(table).select(probe, { count: 'exact', head: true });
    if (!res.error) total += res.count ?? 0;
  }

  return total;
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
  // Never echo the key — only a redacted project ref for operator clarity.
  const ref = url ? url.replace(/^https?:\/\//, '').split('.')[0] : 'unconfigured';
  return { supabase_project_ref: ref, service_role_configured: Boolean(env) };
}
