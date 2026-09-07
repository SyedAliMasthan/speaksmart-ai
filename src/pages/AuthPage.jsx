import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { useAuth } from '../hooks/useAuth';
const TITLES = { login: 'Welcome back', signup: 'Start your English journey', forgot: 'Reset your password', reset: 'Choose a new password' };
export default function AuthPage({ mode }) {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  useEffect(() => { setMessage(''); setError(''); setPassword(''); }, [mode]);
  if (!loading && user && mode === 'login') return <Navigate to="/dashboard" replace />;
  async function submit(event) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setMessage('');
    try {
      let result;
      if (mode === 'login') {
        result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw new Error('Sign-in failed. Check your email, password and email verification.');
      } else if (mode === 'signup') {
        result = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/dashboard` } });
        if (result.error) throw new Error('Unable to complete sign-up. Please try later or use password recovery.');
        setPassword(''); setMessage('Check your email for the next step. If you already have an account, sign in or reset your password.');
      } else if (mode === 'forgot') {
        await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        setMessage('If an account can be recovered, a reset link will arrive by email. Open it in this browser.');
      } else {
        const { data, error: sessionError } = await supabase.auth.getUser();
        if (sessionError || !data.user) throw new Error('Open a valid recovery link in this browser first.');
        result = await supabase.auth.updateUser({ password });
        if (result.error) throw new Error('Unable to change your password. Use a new recovery link and try again.');
        setPassword(''); setMessage('Password updated. You can continue to your dashboard.');
      }
    } catch (failure) { setError(failure.message || 'Please try again later.'); }
    finally { setBusy(false); }
  }
  return <main className="account-card"><Link to="/" className="brand-link">SpeakSmart AI</Link><h1>{TITLES[mode]}</h1><p className="muted">A little practice, every day.</p>
    <form onSubmit={submit}>
      {mode === 'signup' && <label>Your name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" maxLength={80} required /></label>}
      {mode !== 'reset' && <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" maxLength={254} required /></label>}
      {mode !== 'forgot' && <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 15} maxLength={128} required />{mode !== 'login' && <small>Use at least 15 characters. A memorable passphrase works well.</small>}</label>}
      {mode === 'signup' && <label className="consent"><input type="checkbox" required />I agree to the <Link to="/terms">terms</Link> and have read the <Link to="/privacy">privacy notice</Link>.</label>}
      <button disabled={busy} className="primary">{busy ? 'Please wait…' : ({ login: 'Sign in', signup: 'Create account', forgot: 'Send recovery link', reset: 'Update password' })[mode]}</button>
    </form>
    {error && <p role="alert" className="notice error">{error}</p>}{message && <p role="status" className="notice">{message}</p>}
    <div className="auth-links"><Link to="/login">Sign in</Link><Link to="/signup">Create account</Link><Link to="/forgot-password">Forgot password?</Link>{user && <Link to="/dashboard">Dashboard</Link>}</div>
  </main>;
}
