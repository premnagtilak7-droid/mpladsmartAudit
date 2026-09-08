import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cyslsdavhkpyrdeljvow.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5c2xzZGF2aGtweXJkZWxqdm93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4Nzc5MzksImV4cCI6MjEwNDQ1MzkzOX0.hVRwI9DJ_3fTFqVb8iXTwivLnznC9zQbvH4mlM2E8to';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
