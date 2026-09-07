import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => {
    let alive = true; let eventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      eventReceived = true;
      if (alive) { setSession(next); setLoading(false); setError(''); }
    });
    supabase.auth.getSession().then(({ data, error: failure }) => {
      if (!alive || eventReceived) return;
      setSession(data.session); setError(failure ? 'Unable to check your session. Reload to retry.' : ''); setLoading(false);
    }).catch(() => { if (alive && !eventReceived) { setError('Unable to check your session. Reload to retry.'); setLoading(false); } });
    localStorage.removeItem('lianna_user');
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);
  const signOut = async () => {
    const { error: failure } = await supabase.auth.signOut({ scope: 'local' });
    if (failure) throw new Error('Unable to sign out. Please try again.'); setSession(null);
  };
  return <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, error, signOut }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext); if (!context) throw new Error('useAuth requires AuthProvider'); return context;
}
