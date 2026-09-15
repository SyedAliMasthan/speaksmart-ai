import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('legacy upgrade preserves profiles, protects access and supports new signups', { timeout: 60000 }, async () => {
  const db = new PGlite();
  const one = '11111111-1111-4111-8111-111111111111';
  const two = '22222222-2222-4222-8222-222222222222';
  const three = '33333333-3333-4333-8333-333333333333';
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
      CREATE TABLE public.profiles (
        id uuid PRIMARY KEY REFERENCES auth.users(id), name text, email text,
        native_language text, goal text, level text, streak integer,
        last_active date, created_at timestamp without time zone);
      GRANT ALL ON public.profiles TO PUBLIC;`);
    await db.query('INSERT INTO auth.users(id,email) VALUES ($1,$2),($3,$4)', [one,'one@example.test',two,'two@example.test']);
    await db.query(`INSERT INTO public.profiles VALUES ($1,'Existing name','one@example.test','Tamil','Work','Beginner',7,'2026-09-01','2026-08-01')`, [one]);
    const original = (await db.query('SELECT * FROM public.profiles WHERE id=$1',[one])).rows[0];
    const sql = await readFile('supabase/upgrade-legacy-profiles.sql','utf8');
    await db.exec(sql);
    const { full_name, ...preserved } = (await db.query('SELECT * FROM public.profiles WHERE id=$1',[one])).rows[0];
    assert.equal(full_name, 'Existing name');
    assert.deepEqual(preserved, original);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.profiles')).rows[0].n,2);
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM public.profiles'), e=>e.code==='42501');
    await assert.rejects(db.query('SELECT public.export_user_data($1)',[one]), e=>e.code==='42501');
    await db.exec('RESET ROLE; SET ROLE authenticated');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[one]);
    assert.deepEqual((await db.query('SELECT id FROM public.profiles')).rows, [{id:one}]);
    await assert.rejects(db.query('UPDATE public.profiles SET id=$1 WHERE id=$2',[two,one]), e=>e.code==='42501');
    await db.query("INSERT INTO public.practice_sessions(user_id,lesson_id,summary,completed) VALUES ($1,'travel','Saved paragraph',true)",[one]);
    await db.exec('RESET ROLE');
    await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ($1,$2,$3)',[three,'three@example.test',JSON.stringify({full_name:'New user'})]);
    assert.equal((await db.query('SELECT full_name FROM public.profiles WHERE id=$1',[three])).rows[0].full_name,'New user');
    await db.exec(sql);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.profiles')).rows[0].n,3);
    assert.equal((await db.query('SELECT summary FROM public.practice_sessions')).rows[0].summary,'Saved paragraph');
  } finally { await db.close(); }
});
