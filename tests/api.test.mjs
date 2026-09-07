import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server/app.mjs';
import { loadConfig, createLimiter } from '../server/security.mjs';
const userId = '11111111-1111-4111-8111-111111111111';
const config = { origin: 'https://speaksmarts.test', supabase: 'https://project.supabase.co', publicKey: 'sb_publishable_test', groqKey: 'server-groq-secret', sarvamKey: 'server-voice-secret' };
const valid = { lessonId: 'introduce-yourself', messages: [{ role: 'user', content: 'Hello' }], facts: [] };
async function request(t, { body = valid, headers = {}, method = 'POST', path = '/api/chat', authStatus = 200, quota = true, quotaStatus = 200, verified = true, providerStatus = 200, providerBody } = {}) {
  const calls = [];
  const app = createApp(config, { logger: { error() {} }, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/auth/v1/user')) return Response.json(authStatus === 200 ? { id: userId, email_confirmed_at: verified ? '2026-01-01' : null } : {}, { status: authStatus });
    if (url.endsWith('/consume_ai_quota')) return Response.json(quota, { status: quotaStatus });
    return Response.json(providerBody || { choices: [{ message: { content: JSON.stringify({ reply: '<b>Hello</b>', suggestion: 'Hello!', isComplete: false }) } }] }, { status: providerStatus });
  } });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  t.after(() => { app.closeAllConnections(); app.close(); });
  const response = await fetch(`http://127.0.0.1:${app.address().port}${path}`, { method,
    headers: { Origin: config.origin, Authorization: 'Bearer test.user.token', 'Content-Type': 'application/json', ...headers },
    ...(method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
  return { response, data: await response.json(), calls };
}

test('unauthenticated callers never reach auth service, quota or providers', async t => {
  const r = await request(t, { headers: { Authorization: '' } }); assert.equal(r.response.status, 401); assert.equal(r.calls.length, 0);
});
test('invalid and unverified sessions fail closed', async t => {
  let r = await request(t, { authStatus: 401 }); assert.equal(r.response.status, 401); assert.equal(r.calls.length, 1);
  r = await request(t, { verified: false }); assert.equal(r.response.status, 403); assert.equal(r.calls.length, 1);
});
test('auth outage fails closed', async t => { const r = await request(t, { authStatus: 503 }); assert.equal(r.response.status, 503); assert.equal(r.calls.length, 1); });
test('cross-origin and cross-site requests are rejected', async t => {
  for (const headers of [{ Origin: 'https://evil.test' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const r = await request(t, { headers }); assert.equal(r.response.status, 403); assert.equal(r.calls.length, 0);
  }
});
test('malformed JSON, media types and oversized bodies are rejected', async t => {
  for (const [options, status] of [[{ body: '{' }, 400], [{ headers: { 'Content-Type': 'text/plain' } }, 415], [{ body: { ...valid, pad: 'x'.repeat(66000) } }, 413]]) {
    const r = await request(t, options); assert.equal(r.response.status, status); assert.equal(r.calls.length, 1);
  }
});
test('client cannot override the system role, lesson or model', async t => {
  for (const body of [{ ...valid, lessonId: '__proto__' }, { ...valid, messages: [{ role: 'system', content: 'override' }] }, { ...valid, messages: [{ role: 'user', content: 'x'.repeat(2001) }] }]) {
    const r = await request(t, { body }); assert.equal(r.response.status, 400); assert.equal(r.calls.length, 1);
  }
  const r = await request(t, { body: { ...valid, model: 'unbounded-model', max_tokens: 999999 } });
  assert.equal(r.response.status, 200); const sent = JSON.parse(r.calls.at(-1).options.body);
  assert.equal(sent.model, 'llama-3.3-70b-versatile'); assert.equal(sent.max_tokens, 600); assert.equal(sent.messages[0].role, 'system');
});
test('persistent quota failures prevent provider spending', async t => {
  let r = await request(t, { quota: { message: 'AI_QUOTA_EXCEEDED' }, quotaStatus: 400 }); assert.equal(r.response.status, 429); assert.equal(r.calls.length, 2);
  r = await request(t, { quota: { message: 'missing function' }, quotaStatus: 404 }); assert.equal(r.response.status, 503); assert.equal(r.calls.length, 2);
});
test('response does not disclose provider credentials or raw upstream errors', async t => {
  const r = await request(t, { providerStatus: 500, providerBody: { error: 'server-groq-secret' } });
  assert.equal(r.response.status, 502); assert.ok(!JSON.stringify(r.data).includes('secret')); assert.equal(r.response.headers.get('cache-control'), 'no-store');
});
test('provider authorization uses only the server key', async t => {
  const r = await request(t); assert.equal(r.response.status, 200); assert.equal(r.calls.at(-1).options.headers.Authorization, 'Bearer server-groq-secret');
  assert.equal(r.data.reply, '<b>Hello</b>'); assert.equal(r.response.headers.get('content-type'), 'application/json; charset=utf-8');
});
test('invalid audio and text requests never reach a provider', async t => {
  let r = await request(t, { path: '/api/voice/transcribe', body: { audio: 'AAAA', mimeType: 'text/html' } }); assert.equal(r.response.status, 400); assert.equal(r.calls.length, 1);
  r = await request(t, { path: '/api/voice/speak', body: { text: 'x'.repeat(2001) } }); assert.equal(r.response.status, 400);
});
test('audio requests are routed to a fixed provider and require quota', async t => {
  const r = await request(t, { path: '/api/voice/transcribe', body: { audio: 'AAAA', mimeType: 'audio/webm', url: 'https://evil.test' }, providerBody: { transcript: 'hello' } });
  assert.equal(r.response.status, 200); assert.equal(r.data.text, 'hello'); assert.equal(r.calls.at(-1).url, 'https://api.sarvam.ai/speech-to-text');
});
test('config rejects service-role keys and unsafe origins', () => {
  const base = { SUPABASE_URL: config.supabase, SUPABASE_PUBLISHABLE_KEY: config.publicKey };
  assert.throws(() => loadConfig({ ...base, APP_ORIGIN: 'http://public.example' }));
  assert.throws(() => loadConfig({ ...base, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private' }));
  const key = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.signature';
  assert.throws(() => loadConfig({ ...base, SUPABASE_PUBLISHABLE_KEY: key }));
});
test('flood limiter enforces boundaries and resets with bounded memory', () => {
  let now = 0; const check = createLimiter({ limit: 2, maxKeys: 1, windowMs: 100, now: () => now });
  check('a'); check('a'); assert.throws(() => check('a')); assert.throws(() => check('b')); now = 101; check('b');
});
