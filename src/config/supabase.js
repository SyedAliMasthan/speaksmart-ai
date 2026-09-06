import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // SECURITY: PKCE prevents auth code interception
  },
  global: {
    headers: { 'x-app-version': import.meta.env.VITE_APP_VERSION || '2.0.0' },
  },
});

// ─── Google OAuth ───
export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });

// ─── Magic Link (passwordless) ───
export const signInWithMagicLink = (email) =>
  supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/dashboard` },
  });

// ─── Email/Password ───
export const signUpWithEmail = (email, password, name) =>
  supabase.auth.signUp({
    email, password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${window.location.origin}/dashboard`,
    },
  });

export const signInWithEmail = (email, password) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();

export const resetPassword = (email) =>
  supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

export const getUser = () => supabase.auth.getUser();
export const getSession = () => supabase.auth.getSession();

export default supabase;
