import { createClient } from '@supabase/supabase-js';

// Next.js evaluates this module during both server rendering and browser
// hydration. Always give the SDK syntactically valid values so a missing or
// temporarily unavailable Vercel environment variable cannot crash the app.
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_ANON_KEY = 'placeholder-anon-key';

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const configuredAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

export const isSupabaseConfigured = Boolean(configuredUrl && configuredAnonKey);

export const supabase = createClient(
  configuredUrl || PLACEHOLDER_URL,
  configuredAnonKey || PLACEHOLDER_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
