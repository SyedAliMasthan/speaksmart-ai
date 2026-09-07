import { supabase } from '../config/supabase';
export async function apiRequest(path, body) {
  if (!['/api/chat', '/api/voice/transcribe', '/api/voice/speak'].includes(path)) throw new Error('Invalid request.');
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error('Please sign in again.');
  let response;
  try { response = await fetch(path, { method: 'POST', credentials: 'omit', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body), signal: AbortSignal.timeout(40000), redirect: 'error' });
  } catch { throw new Error('Unable to connect. Please try again.'); }
  let data;
  try { data = await response.json(); } catch { throw new Error('The service is temporarily unavailable.'); }
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Please try again later.');
  return data;
}
