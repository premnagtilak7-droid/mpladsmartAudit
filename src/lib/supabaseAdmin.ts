// Server-only helpers for privileged Supabase access + officer authorization.
//
// SECURITY MODEL
//   • The browser client (src/lib/supabase.ts) only ever uses the anon key and
//     is limited by RLS.
//   • These helpers use the SERVICE ROLE key, which bypasses RLS. They must be
//     imported ONLY from server route handlers (src/app/api/**). Never import
//     this module into a client component.
//   • Callers must still pass an officer authorization check (see
//     assertOfficer) before mutating data.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface AdminEnv {
  url: string;
  serviceRoleKey: string;
}

/**
 * Reads the service-role credentials from the server environment.
 * Returns null when not configured so callers can emit a clean 503 instead of
 * throwing an opaque crash.
 */
export function readAdminEnv(): AdminEnv | null {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

/**
 * Creates a service-role Supabase client. Throws if credentials are missing —
 * call sites should prefer getAdminClient() which returns null.
 */
export function createAdminClient(): SupabaseClient {
  const env = readAdminEnv();
  if (!env) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL is not configured.');
  }

  return createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Null-returning variant for graceful 503 handling in route handlers. */
export function getAdminClient(): SupabaseClient | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

/**
 * Minimal officer credential assertion for privileged admin routes.
 *
 * The deployment front-end performs rich RBAC client-side, but a server route
 * must not trust the browser. Privileged routes therefore require a shared
 * admin token supplied via the `x-admin-token` header (or `Authorization:
 * Bearer <token>`) matching ADMIN_API_TOKEN. When ADMIN_API_TOKEN is unset the
 * routes fail CLOSED (deny), so an unconfigured deployment can never expose an
 * unauthenticated purge / bulk-write endpoint.
 */
export interface AuthResult {
  ok: boolean;
  status: number;
  error?: string;
}

export const ADMIN_TOKEN_HEADER = 'x-admin-token';

export function assertOfficer(req: Request): AuthResult {
  const expected = process.env.ADMIN_API_TOKEN || '';
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error:
        'Admin API is not configured on the server. Set ADMIN_API_TOKEN in the environment to enable privileged routes.',
    };
  }

  const headerToken = req.headers.get(ADMIN_TOKEN_HEADER) || '';
  const bearer = req.headers.get('authorization') || '';
  const bearerToken = bearer.toLowerCase().startsWith('bearer ')
    ? bearer.slice(7).trim()
    : '';
  const supplied = headerToken.trim() || bearerToken;

  if (!supplied || !timingSafeEqual(supplied, expected)) {
    return { ok: false, status: 401, error: 'Unauthorized: valid officer admin token required.' };
  }

  return { ok: true, status: 200 };
}

/** Constant-time-ish string comparison to avoid trivial timing oracles. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
