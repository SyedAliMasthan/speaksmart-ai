import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const first = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
async function caller(role, id = '') { await db.exec(`RESET ROLE; SET ROLE ${role};`); await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]); }
async function denied(fn) { await assert.rejects(fn, e => e.code === '42501'); }
before(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;`);
  for (const path of ['000_schema.sql','001_rls_policies.sql','002_security_patch.sql']) await db.exec(await readFile(`supabase/migrations/${path}`, 'utf8'));
  await db.query('INSERT INTO auth.users(id,email) VALUES ($1,$2),($3,$4)', [first,'one@example.test',other,'two@example.test']);
});
after(() => db.close());
test('anonymous roles cannot call privileged data functions', async () => {
  await caller('anon');
  await denied(() => db.query('SELECT public.export_user_data($1)', [first]));
  await denied(() => db.query('SELECT public.delete_user_data($1)', [first]));
  await denied(() => db.query('SELECT public.consume_ai_quota()'));
});
test('authenticated role without a user ID cannot bypass the null guard', async () => {
  await caller('authenticated');
  await denied(() => db.query('SELECT public.export_user_data($1)', [other]));
  await denied(() => db.query('SELECT public.delete_user_data($1)', [other]));
  await denied(() => db.query('SELECT public.consume_ai_quota()'));
});
test('one user cannot export or delete another user', async () => {
  await caller('authenticated', first);
  await denied(() => db.query('SELECT public.export_user_data($1)', [other]));
  await denied(() => db.query('SELECT public.delete_user_data($1)', [other]));
  const r = await db.query('SELECT public.export_user_data($1) AS data', [first]); assert.equal(r.rows[0].data.profile.id, first);
});
test('RLS isolates direct table reads and writes', async () => {
  await caller('authenticated', first);
  const rows = (await db.query('SELECT id FROM public.profiles')).rows; assert.deepEqual(rows.map(r=>r.id), [first]);
  await denied(() => db.query("INSERT INTO public.practice_sessions(user_id,lesson_id) VALUES ($1,'travel')", [other]));
  await db.query("INSERT INTO public.practice_sessions(user_id,lesson_id,summary,completed) VALUES ($1,'travel','My trip',true)", [first]);
  await caller('authenticated', other); assert.equal((await db.query('SELECT * FROM public.practice_sessions')).rows.length, 0);
});
test('quotas are persistent, isolated and not user-writable', async () => {
  await caller('authenticated', first);
  for (let i=0;i<20;i++) assert.equal((await db.query('SELECT public.consume_ai_quota() AS accepted')).rows[0].accepted, true);
  await assert.rejects(() => db.query('SELECT public.consume_ai_quota()'), /AI_QUOTA_EXCEEDED/);
  await denied(() => db.query('DELETE FROM speaksmart_private.ai_usage'));
  await caller('authenticated', other); assert.equal((await db.query('SELECT public.consume_ai_quota() AS accepted')).rows[0].accepted, true);
});
test('reapplying the security patch preserves existing user data', async () => {
  await db.exec('RESET ROLE'); await db.exec(await readFile('supabase/migrations/002_security_patch.sql','utf8'));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.profiles')).rows[0].n, 2);
});
