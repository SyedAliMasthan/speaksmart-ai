import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  session = "33333333-3333-4333-8333-333333333333",
  turn = "44444444-4444-4444-8444-444444444444";
async function caller(role, id = "") {
  await db.exec(`RESET ROLE; SET ROLE ${role}`);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
}
const start = () =>
  db.query("SELECT (public.coach_start_session($1,'daily','{}','Hello')).*", [
    session,
  ]);
const append = (revision = 0, tid = turn) =>
  db.query(
    "SELECT to_jsonb(public.coach_append_turn($1,$2,$3,'Hello there','Tell me more',NULL,25)) AS s",
    [session, revision, tid],
  );
before(async () => {
  await db.exec(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO anon,authenticated;",
  );
  await db.exec(
    await readFile("supabase/migrations/003_coach_rebuild.sql", "utf8"),
  );
  await db.query("INSERT INTO auth.users VALUES ($1),($2)", [owner, other]);
});
after(() => db.close());
test("anonymous calls and null identity cannot create sessions", async () => {
  await caller("anon");
  await assert.rejects(start, (e) => e.code === "42501");
  await caller("authenticated");
  await assert.rejects(start, (e) => e.code === "42501");
});
test("session creation is idempotent and owner-scoped", async () => {
  await caller("authenticated", owner);
  await start();
  await start();
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM public.coach_sessions"))
      .rows[0].n,
    1,
  );
  await caller("authenticated", other);
  assert.equal(
    (await db.query("SELECT * FROM public.coach_sessions")).rows.length,
    0,
  );
  await assert.rejects(start, /SESSION_NOT_FOUND/);
  await assert.rejects(() => append(), /SESSION_NOT_FOUND/);
});
test("direct writes cannot bypass the session RPC", async () => {
  await caller("authenticated", owner);
  await assert.rejects(
    () => db.query("UPDATE public.coach_sessions SET status='completed'"),
    (e) => e.code === "42501",
  );
});
test("append rejects stale revisions and deduplicates a lost-response retry", async () => {
  await caller("authenticated", owner);
  let row = (await append()).rows[0].s;
  assert.equal(row.revision, 1);
  assert.equal(row.transcript.length, 3);
  assert.equal(row.duration_seconds, 25);
  row = (await append()).rows[0].s;
  assert.equal(row.revision, 1);
  assert.equal(row.transcript.length, 3);
  await assert.rejects(
    () => append(0, "55555555-5555-4555-8555-555555555555"),
    /SESSION_CONFLICT/,
  );
  await append(1, "55555555-5555-4555-8555-555555555555");
});
test("completion saves once and blocks later turns", async () => {
  await caller("authenticated", owner);
  const complete = () =>
    db.query(
      'SELECT to_jsonb(public.coach_complete_session($1,2,\'{"summary":"Good effort"}\',60)) AS s',
      [session],
    );
  let row = (await complete()).rows[0].s;
  assert.equal(row.status, "completed");
  assert.equal(row.duration_seconds, 60);
  const timestamp = row.completed_at;
  row = (await complete()).rows[0].s;
  assert.equal(row.completed_at, timestamp);
  await assert.rejects(
    () => append(2, "66666666-6666-4666-8666-666666666666"),
    /SESSION_COMPLETE/,
  );
  await caller("authenticated", other);
  await assert.rejects(complete, /SESSION_NOT_FOUND/);
});
test("learning preferences are isolated and enforce valid values", async () => {
  await caller("authenticated", owner);
  await db.query(
    "INSERT INTO public.coach_profiles VALUES ($1,'Tamil','Building confidence','Everyday conversations',10)",
    [owner],
  );
  await assert.rejects(
    () =>
      db.query(
        "INSERT INTO public.coach_profiles VALUES ($1,'Tamil','Building confidence','Everyday conversations',10)",
        [other],
      ),
    (e) => e.code === "42501",
  );
  await caller("authenticated", other);
  assert.equal(
    (await db.query("SELECT * FROM public.coach_profiles")).rows.length,
    0,
  );
});
test("reapplying the migration preserves conversations", async () => {
  await db.exec("RESET ROLE");
  await db.exec(
    await readFile("supabase/migrations/003_coach_rebuild.sql", "utf8"),
  );
  assert.equal(
    (await db.query("SELECT revision FROM public.coach_sessions")).rows[0]
      .revision,
    2,
  );
});
