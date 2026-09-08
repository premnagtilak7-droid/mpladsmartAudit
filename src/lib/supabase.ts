import { createClient } from '@supabase/supabase-js';

/**
 * Edge-safe Supabase client.
 * Uses NEXT_PUBLIC env vars. In local/preview with no env vars set, `isSupabaseConfigured`
 * is false and the app falls back to a bundled mock dataset so the UI is fully
 * navigable without a live DB.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase =
  isSupabaseConfigured && url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
