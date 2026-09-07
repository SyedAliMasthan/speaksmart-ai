export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function loadConfig(env = process.env) {
  const origin = new URL(env.APP_ORIGIN || 'https://speaksmarts.in');
  const supabase = new URL(env.SUPABASE_URL || 'https://missing.invalid');
  if (origin.origin !== (env.APP_ORIGIN || 'https://speaksmarts.in') ||
      (origin.protocol !== 'https:' && !(env.NODE_ENV === 'development' && origin.hostname === 'localhost'))) {
    throw new Error('APP_ORIGIN must be one HTTPS origin (localhost is allowed in development).');
  }
  if (supabase.protocol !== 'https:' || supabase.username || supabase.password || supabase.pathname !== '/' || supabase.search || supabase.hash) {
    throw new Error('SUPABASE_URL must be an HTTPS origin.');
  }
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!env.SUPABASE_URL || !key || key.startsWith('sb_secret_')) throw new Error('Configure a Supabase public/publishable key, never a service key.');
  if (key.startsWith('eyJ')) {
    let role;
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role; } catch { throw new Error('Invalid Supabase key.'); }
    if (role !== 'anon') throw new Error('Only the legacy anon key is permitted.');
  } else if (!key.startsWith('sb_publishable_')) throw new Error('Invalid Supabase publishable key.');
  return Object.freeze({ origin: origin.origin, supabase: supabase.origin, publicKey: key,
    groqKey: env.GROQ_API_KEY || '', sarvamKey: env.SARVAM_API_KEY || '',
    host: '127.0.0.1', port: Number(env.PORT || 3001) });
}

export function securityHeaders(origin) {
  return {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin', 'Vary': 'Origin',
  };
}

export function bearerToken(headers) {
  const value = headers.authorization;
  if (typeof value !== 'string' || value.length > 8192 || !/^Bearer [A-Za-z0-9._~-]+$/.test(value)) {
    throw new HttpError(401, 'Sign in to continue.');
  }
  return value.slice(7);
}

// Bounded, fail-closed process-level flood protection. Persistent user quotas live in PostgreSQL.
export function createLimiter({ limit = 120, windowMs = 60000, maxKeys = 5000, now = Date.now } = {}) {
  const counters = new Map();
  return (key) => {
    const time = now();
    if (counters.size >= maxKeys) for (const [k, v] of counters) if (v.until <= time) counters.delete(k);
    let counter = counters.get(key);
    if (!counter || counter.until <= time) {
      if (!counter && counters.size >= maxKeys) throw new HttpError(429, 'Too many requests. Try again shortly.');
      counter = { count: 0, until: time + windowMs }; counters.set(key, counter);
    }
    if (++counter.count > limit) throw new HttpError(429, 'Too many requests. Try again shortly.');
  };
}

export async function readJson(req, maximum = 65536) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Send JSON content.');
  if (Number(req.headers['content-length']) > maximum) throw new HttpError(413, 'Request is too large.');
  const chunks = []; let size = 0;
  // Do not destroy the socket before the handler can send a controlled 413 response.
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maximum) { req.resume(); throw new HttpError(413, 'Request is too large.'); }
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new HttpError(400, 'Invalid JSON request.'); }
}

export async function boundedJson(response, limit = 1000000) {
  const reader = response.body?.getReader();
  if (!reader) throw new HttpError(502, 'The service returned an invalid response.');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new HttpError(502, 'The service response was too large.'); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'The service returned an invalid response.');
  }
}

export async function authenticate(token, config, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(`${config.supabase}/auth/v1/user`, {
      headers: { apikey: config.publicKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000), redirect: 'error',
    });
  } catch { throw new HttpError(503, 'Sign-in verification is temporarily unavailable.'); }
  if (response.status === 401 || response.status === 403) throw new HttpError(401, 'Your session expired. Sign in again.');
  if (!response.ok) throw new HttpError(503, 'Sign-in verification is temporarily unavailable.');
  const user = await boundedJson(response, 65536);
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(user.id || '')) throw new HttpError(401, 'Invalid session.');
  if (!user.email_confirmed_at && !user.phone_confirmed_at) throw new HttpError(403, 'Verify your email before using AI practice.');
  return user;
}

export async function consumeQuota(token, config, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(`${config.supabase}/rest/v1/rpc/consume_ai_quota`, {
      method: 'POST', headers: { apikey: config.publicKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}', signal: AbortSignal.timeout(8000), redirect: 'error',
    });
  } catch { throw new HttpError(503, 'Usage checks are temporarily unavailable.'); }
  const result = await boundedJson(response, 65536);
  if (!response.ok && result?.message === 'AI_QUOTA_EXCEEDED') throw new HttpError(429, 'Your AI usage limit has been reached. Try later.');
  if (!response.ok || result !== true) throw new HttpError(503, 'Usage checks are temporarily unavailable.');
}
