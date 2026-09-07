# Staged deployment

These are deployment templates, not evidence that production is secured. The observed live Lianna pages differed from this React repository. Inventory the real document root, API process, database schema, DNS, proxy and certificate configuration before replacing them. Keep a restorable copy of the current app, proxy configuration and databases. No production deployment is performed by CI.

## Supabase

1. Back up the database and run the read-only `supabase/preflight.sql` on staging. Inspect all existing policies: permissive policies are OR-combined, so an unrelated broad policy can defeat owner-only access.
2. Migration 000 creates a fresh schema; `IF NOT EXISTS` does not upgrade existing tables. Compare existing types, required columns and constraints with 000. In particular the new `practice_sessions` interface requires UUID id/user_id, text lesson_id/summary, boolean completed and timestamp created_at. Plan a compatible, data-preserving migration if your existing schema differs. Do not blindly recreate or drop tables.
3. On compatible staging, apply 001 and 002, then repeat the two-user isolation checks. Patch 002 repairs privileged function access and adds persistent quotas. It does not replace existing table policies. Never expose the private quota schema through PostgREST.
4. Enable email confirmation, set a minimum 15-character password policy, configure SMTP and auth rate limits, and restrict redirect URLs to the actual origins plus `/dashboard` and `/reset-password`. Test confirmation and password recovery in the same browser used to initiate PKCE. Enable available breached-password protections. Set a suitably short JWT lifetime; sign-out does not instantly invalidate already issued access tokens everywhere.
5. The frontend and API must use the same Supabase project and public key. The API validates sessions with Supabase and requires a confirmed account. It must never use a service-role key.

## SpeakSmart on an existing Ubuntu/Nginx host

Use a supported OS and Node.js 24. Create a dedicated unprivileged `speaksmart` service account. Install source under `/opt/speaksmart-ai`, owned by the administrator and readable by the service. Install `.env.server.example` values as `/etc/speaksmart/api.env`, root-owned mode 0600. Adjust `/usr/bin/node` in the supplied systemd unit to your real Node 24 binary.

Build with `npm ci && npm run validate` and the correct public configuration. Stage the new `dist` in a separate release directory; switch the document root only after staging acceptance. Do not leave old JavaScript bundles containing provider keys in the public document root. Rotate any provider keys previously used in browser builds and purge old cached bundles; removing source variables does not revoke a key.

Install `deploy/speaksmart-api.service` as a systemd unit. Its API binds only to 127.0.0.1:3001. Install `deploy/security-headers.conf` as `/etc/nginx/snippets/speaksmart-security.conf`, replacing the Supabase origin if needed. Integrate the root `nginx.conf` within the existing http context, preserving other virtual hosts. Check certificate coverage for both root and www names. Run `nginx -t` before reload. Do not overwrite the host's global nginx.conf.

If OpenShift is the actual target, adapt these templates to the cluster's existing deployment pipeline: keep an ingress proxy and loopback API in the same pod, mount server values from a Secret, run with the namespace-assigned non-root UID, restrict ingress to the proxy port, set resource limits and probes, and permit only needed DNS/provider egress. The repository does not include a validated OpenShift deployment. Do not use the Ubuntu systemd unit inside a container.

## SpendWise on the same host

Use `apps/spendwise/compose.proxy.yaml` so the existing host proxy retains ports 80/443. Configure `APP_DOMAIN=finance.speaksmarts.in` in that directory's `.env`, provision its certificate, and integrate the finance proxy snippet. Port 8000 is loopback-only. Preserve the existing `spendwise_finance_data` volume; inspect the actual volume name before starting an imported deployment. Never use `docker compose down -v` for an upgrade. Back up and test restore using the included scripts. Create the owner's account interactively using the documented CLI; no default password is supplied.

The root domain does not share finance cookies, CSRF tokens, database files, or auth sessions. Finance uses a Secure, HttpOnly, SameSite, host-prefixed session cookie. The installer supports the OS versions listed in its own guide; it does not upgrade Ubuntu 20.04. Database files and backups contain financial records: restrict access and keep encrypted off-host backups.

## Acceptance and rollback

On staging, verify email confirmation, login, reset, logout, two-user record isolation, a completed paragraph after refresh, chat and both speech endpoints, microphone cleanup, invalid/expired session rejection and quota exhaustion. Verify security headers on HTML, assets, API errors and missing assets. Verify finance login, CSRF rejection, income/expense totals, transfer exclusion, budgets, CSV, concurrent edits, restart persistence and backup restoration. Browser/device testing, real provider access, SMTP and production proxy checks require the actual environment and were not completed locally.

The health endpoint proves the API process is responsive, not that external providers are healthy. Monitor sanitized error counts and quota rejections; avoid logging request bodies, credentials or financial records. Quotas are per user (20/minute, 200/day shared across chat and voice); set provider account spending limits and signup protections to address abuse across many accounts.

Keep the prior code release for rollback, but do not re-enable exposed provider keys or revert corrected database authorization. Coordinate database changes separately; an app rollback alone cannot undo a schema migration. Keep finance backups and volumes intact.
