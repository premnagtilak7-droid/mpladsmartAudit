import { createClient } from '@supabase/supabase-js';

/**
 * Browser-safe Supabase client for the live MPLAD dataset.
 * The project URL has a safe public default so local builds can still resolve
 * the client; the anon key must be supplied through the environment.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cyslsdavhkpyrdeljvow.supabase.co';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(anonKey);

export const supabase = anonKey
  ? createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
