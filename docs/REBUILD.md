# SpeakSmarts v3 rebuild

Branch: `rebuild/coach-v3`. Release: `3.0.0-alpha.1`.

This is milestone 1 of a staged, original rebuild inspired by the capabilities of voice-first language tutors. It is not a copy of Fluently's code, content or branding, and does not claim feature parity. Production deployment is intentionally separate from this branch.

## Milestone 1: complete practice loop

New code in `src/coach`, `server/coach` and `shared/coach.js` supplies:

- Original responsive landing page and learning workspace, with a clearly labelled public `/preview`.
- Preferences for explanation language, starting level, goal and daily practice time.
- Six scenarios: daily conversation, introductions, interviews, meetings, travel, and technical incident updates.
- Text conversation and record/transcribe/respond/play voice turns using the server's existing Groq and Sarvam adapters.
- Explicit recording stop, playback interruption, typed fallback and recoverable errors.
- Server-loaded transcript context: the browser cannot override the model or submit a replacement conversation history to the coach endpoint.
- Session persistence per turn, resume, optimistic concurrency and idempotent retry of saved turns/completion.
- Text-based corrections, session summaries, suggested next steps, history and correction notebook.
- Earlier saved paragraphs remain available in My progress. The new migration does not modify or remove these records.
- Session ownership policies, provider keys confined to the server, existing persistent quota enforcement, and extended operator export/delete procedures.

No assessment numbers are fabricated. Pronunciation and spoken fluency remain explicitly unassessed. Selected learner level is self-reported, not an assessed CEFR level.

## Architecture

Browser React app -> authenticated Node API -> Supabase REST/RPC with the learner's bearer token.

Text path: saved transcript + learner preferences -> Groq -> validated short reply/correction -> transactional session append.

Voice path: browser MediaRecorder -> bounded recording -> Sarvam STT -> text path -> Sarvam TTS -> browser playback.

The voice implementation is turn-based, not streamed full duplex. The learner taps to speak; silence stops recording after approximately 1.8 seconds. Each recording is limited to 25 seconds and 512 KiB. A session accepts at most 40 answers. Report generation requires at least two answers.

## Data and consistency

`003_coach_rebuild.sql` adds `coach_profiles` and `coach_sessions`. SQL functions derive the owner from `auth.uid()`, lock session rows for writes, reject stale revisions, and deduplicate turn IDs. The API normalises composite RPC responses from PostgREST. An already-saved turn retry does not invoke an AI provider again. Two simultaneous in-flight requests can still incur provider work before the database rejects/deduplicates one; provider usage reservation is a later hardening item.

The application's data-export and learning-data-deletion functions include the new tables. Deleting learning data does not delete the Supabase Auth identity; full account deletion remains operator-managed.

Profiles are user-editable. RPC writes use authenticated ownership-scoped permissions rather than a service key. A user can invoke these RPCs directly to modify their own practice data. These records must not be treated as trusted certification, billing or exam results. Provider credentials remain inaccessible to that path.

Practice time counts visible-tab time, including reading, listening and answering; it is persisted after each successful turn and completion. Time after the last saved turn can be lost on navigation. Progress currently summarises the 60 most recent sessions, not lifetime totals. Earlier paragraphs are limited to the latest 30.

Raw audio is processed but not stored by this app. Transcripts, preferences and reports are stored in Supabase. Provider retention terms must be checked before a production pilot. The existing privacy notice has been updated to describe stored transcripts and reviews.

## Run locally

Use Node 24 and a **staging Supabase project** with the existing email-confirmation flow.

1. `npm ci`
2. Copy `.env.example` to `.env.local`; fill only public Supabase URL/key values.
3. Copy `.env.server.example` to `.env.server`; set matching staging Supabase values, `APP_ORIGIN=http://localhost:5173`, `NODE_ENV=development` and provider keys. Never put provider or privileged keys in `VITE_` settings.
4. On a fresh staging project, apply migrations `000`, `001`, `002`, then `003`. On an existing project, inspect compatibility and backups first, then apply `003` after the existing migrations. The migration notifies PostgREST to refresh its schema cache.
5. Set the staging Auth site URL and approved recovery/confirmation redirects to localhost. Never copy production credentials into a shared preview.
6. Terminal 1: `npm run dev:api`
7. Terminal 2: `npm run dev`
8. Open `http://localhost:5173`, register and verify a staging email, then set preferences.

Without browser Supabase configuration, the public landing page and `/preview` still render. Account and AI features show unavailable states rather than using a demo identity or bypassing authentication. `/preview` does not make AI calls or store learner data.

## Validation

Run `npm run validate`. Tests cover legacy access controls plus the new session ownership, retry, stale-write, completion, data-export/delete, provider-input, report and playback-cancellation contracts. Database tests run actual PostgreSQL SQL in PGlite. API provider responses are mocked: these tests do not establish live Groq/Sarvam availability or real speech quality.

Before staging approval, manually verify:

- Registration, confirmation, sign-in, recovery and sign-out.
- Tamil/Hindi/Telugu explanation quality using real provider calls.
- Two typed turns -> review -> refresh -> history.
- Voice capture, silence stop, manual stop, blocked microphone, rejected autoplay, playback interruption and typed fallback.
- iPhone Safari and Android Chrome, headphones, network loss and a second tab changing the same session.
- Two separate users cannot see each other's profiles, sessions or reports.
- Existing paragraphs remain visible, and SpendWise remains independently functional.
- No horizontal overflow at 390px, keyboard navigation and reduced motion.

A local production build is not a production deployment. Live provider checks and browser/device QA are still required.

## Release and rollback

Deploy the frontend build and Node backend together to staging after applying `003`. Existing Nginx `/api/` proxy and microphone/media CSP settings are retained. Set one canonical `APP_ORIGIN` and redirect the other hostname to it; origin checks must match the actual browser origin. Existing CI validates/builds but does not deploy.

For a production rollout, first record the currently deployed commit and export the database through the existing operator backup process. Build the new frontend in a separate release directory and restart the backend using the existing deployment workflow. Run authenticated smoke checks before promoting. To roll back, restore the previous frontend/backend release; retain the additive v3 tables and migration rather than dropping learner records. The service-worker cache namespace changes to prevent retaining the prior release cache indefinitely.

## One-by-one roadmap

| Stage | Capability | Acceptance gate | Status |
| --- | --- | --- | --- |
| 1 | Fresh workspace, preferences, voice/text practice, persisted corrections and reviews | Automated tests and production build; then real staging account/provider/device checks | Code implemented; live verification pending |
| 2 | Guided course units, revision queue, saved vocabulary and vocabulary games | Repeated mistakes create exercises; review scheduling works across devices; progress derives from attempts | Planned |
| 3 | Streaming voice, automatic turn-taking, barge-in and reconnect | Measured median/p95 end-of-turn latency; no ghost audio or duplicate turns under disconnect | Planned |
| 4 | Audio-based pronunciation assessment, word/sound drills and baseline assessment | Teacher-reviewed evaluation across Indian accents; uncertainty and unsupported metrics visible | Planned; requires assessment provider selection |
| 5 | Deeper personalisation, topic suggestions, interview role configuration and progress trends | Recommendations use previous attempts; comparisons use equivalent exercises and rubric versions | Planned |
| 6 | Production operations, cost-per-minute metering, plan entitlements, payments if wanted, admin tools | Usage reconciles with providers; billing webhooks idempotent; backup/restore and load tests pass | Planned |
| 7 | Installable mobile experience, reminders, accessibility and native packaging if needed | Real device, accessibility and release checks pass | Planned |

Do not advertise stages 2–7 as available until implemented and validated. Fluently's exact proprietary implementation and scoring are not assumed. Model training, GPUs, Kubernetes and a new authentication system are not prerequisites for this milestone.
