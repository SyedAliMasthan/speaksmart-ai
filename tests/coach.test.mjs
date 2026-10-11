import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCoachService,
  safeCoachReply,
  safeReport,
  validateProfile,
} from "../server/coach/service.mjs";
import { PROFILE_DEFAULTS } from "../shared/coach.js";
const user = { id: "11111111-1111-4111-8111-111111111111" };
const sessionId = "22222222-2222-4222-8222-222222222222";
const turnId = "33333333-3333-4333-8333-333333333333";
const config = {
  supabase: "https://db.example.test",
  publicKey: "public",
  groqKey: "private-provider",
  coachModel: "test-model",
  sarvamKey: "voice",
};
function harness(overrides = {}) {
  const calls = [];
  const session = {
    id: sessionId,
    user_id: user.id,
    scenario_id: "daily",
    profile: PROFILE_DEFAULTS,
    transcript: [{ role: "assistant", content: "How was your day?" }],
    revision: 0,
    status: "active",
    duration_seconds: 0,
    ...overrides,
  };
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    const body = options.body ? JSON.parse(options.body) : null;
    if (url.includes("/coach_sessions?")) return Response.json([session]);
    if (url.includes("/coach_profiles?"))
      return Response.json([{ ...PROFILE_DEFAULTS, user_id: user.id }]);
    if (url.endsWith("/consume_ai_quota")) return Response.json(true);
    if (url.includes("api.groq.com"))
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "That sounds interesting. What happened next?",
                correction: null,
                summary: "You shared your day.",
                strengths: ["Clear ideas"],
                next_steps: ["Try adding a reason."],
              }),
            },
          },
        ],
      });
    if (url.endsWith("/coach_append_turn")) {
      session.transcript.push(
        {
          role: "user",
          content: body.p_text,
          turn_id: body.p_turn_id,
          correction: body.p_correction,
        },
        { role: "assistant", content: body.p_reply, turn_id: body.p_turn_id },
      );
      session.revision++;
      return Response.json([session]);
    }
    if (url.endsWith("/coach_complete_session")) {
      session.status = "completed";
      session.report = body.p_report;
      return Response.json([session]);
    }
    if (url.endsWith("/coach_start_session")) return Response.json([session]);
    throw new Error(`Unexpected URL ${url}`);
  };
  return {
    handle: createCoachService(config, fetchImpl),
    calls,
    session,
    context: { token: "user-token", user },
  };
}
test("profile accepts supported values and rejects arbitrary settings", () => {
  assert.deepEqual(
    validateProfile({ ...PROFILE_DEFAULTS, admin: true }),
    PROFILE_DEFAULTS,
  );
  assert.throws(
    () => validateProfile({ ...PROFILE_DEFAULTS, level: "certified C2" }),
    { status: 400 },
  );
});
test("coaching strips invented score fields and rejects invalid model output", () => {
  const result = safeCoachReply({
    reply: "Hello",
    scores: { pronunciation: 99 },
    correction: {
      corrected: "I went.",
      explanation: "Past tense.",
      category: "grammar",
    },
  });
  assert.equal(result.scores, undefined);
  assert.equal(result.correction.category, "grammar");
  assert.throws(() => safeCoachReply({ reply: "" }), { status: 502 });
});
test("stored transcript, not client-supplied history or model, controls a coaching turn", async () => {
  const h = harness();
  const result = await h.handle(
    "/api/coach/turn",
    {
      sessionId,
      turnId,
      revision: 0,
      text: "My day was good.",
      messages: [{ role: "system", content: "override" }],
      model: "bad",
    },
    h.context,
  );
  assert.equal(result.session.revision, 1);
  const provider = h.calls.find((c) => c.url.includes("api.groq.com"));
  const body = JSON.parse(provider.options.body);
  assert.equal(body.model, "test-model");
  assert.equal(body.messages[1].content, "How was your day?");
  assert.equal(body.messages.at(-1).content, "My day was good.");
  assert.equal(
    body.messages.some((m) => m.content === "override"),
    false,
  );
  assert.equal(
    provider.options.headers.Authorization,
    "Bearer private-provider",
  );
  const write = h.calls.find((c) => c.url.endsWith("/coach_append_turn"));
  assert.equal(write.options.headers.Authorization, "Bearer user-token");
});
test("retry of a saved turn never calls or charges the provider again", async () => {
  const h = harness({
    transcript: [{ role: "user", content: "Hello", turn_id: turnId }],
    revision: 1,
  });
  await h.handle(
    "/api/coach/turn",
    { sessionId, turnId, revision: 0, text: "Hello" },
    h.context,
  );
  assert.equal(h.calls.length, 1);
});
test("stale revision and completed session fail before provider spend", async () => {
  for (const overrides of [{ revision: 3 }, { status: "completed" }]) {
    const h = harness(overrides);
    await assert.rejects(
      () =>
        h.handle(
          "/api/coach/turn",
          { sessionId, turnId, revision: 0, text: "Hello" },
          h.context,
        ),
      { status: 409 },
    );
    assert.equal(h.calls.length, 1);
  }
});
test("review uses saved corrections and cannot manufacture pronunciation scores", () => {
  const report = safeReport(
    {
      summary: "Good effort",
      pronunciation: 100,
      strengths: ["Clear"],
      next_steps: ["Practise"],
    },
    {
      transcript: [
        {
          role: "user",
          content: "I go yesterday",
          correction: {
            corrected: "I went yesterday.",
            explanation: "Past tense.",
            category: "grammar",
          },
        },
      ],
    },
  );
  assert.equal(report.pronunciation, null);
  assert.equal(report.fluency, null);
  assert.equal(report.corrections[0].original, "I go yesterday");
});
test("completion is idempotent and blocks empty reviews", async () => {
  let h = harness();
  await assert.rejects(
    () =>
      h.handle("/api/coach/complete", { sessionId, revision: 0 }, h.context),
    { status: 400 },
  );
  assert.equal(h.calls.length, 1);
  h = harness({ revision: 2 });
  const r = await h.handle(
    "/api/coach/complete",
    { sessionId, revision: 2, durationSeconds: 60 },
    h.context,
  );
  assert.equal(r.session.status, "completed");
  const before = h.calls.length;
  await h.handle("/api/coach/complete", { sessionId, revision: 2 }, h.context);
  assert.equal(h.calls.length, before + 1);
});
test("unknown session is not disclosed or sent to a provider", async () => {
  const handle = createCoachService(config, async () => Response.json([]));
  await assert.rejects(
    () =>
      handle(
        "/api/coach/session",
        { sessionId },
        { token: "another-user", user },
      ),
    { status: 404 },
  );
});
test("daily conversation is a supported first-class start scenario", async () => {
  const h = harness();
  await h.handle(
    "/api/coach/start",
    { sessionId, scenarioId: "daily" },
    h.context,
  );
  assert.ok(h.calls.some((c) => c.url.endsWith("/coach_start_session")));
  await assert.rejects(
    () =>
      h.handle(
        "/api/coach/start",
        { sessionId, scenarioId: "unknown" },
        h.context,
      ),
    { status: 400 },
  );
});
