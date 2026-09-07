# Validation record — 7 September 2026

- `npm run validate`: passed, including the browser boundary/workflow checks, 19 Node/PGlite security tests, and Vite production build.
- `npm audit --audit-level=high`: zero reported vulnerabilities.
- SpendWise: 11 unittest cases passed, including account isolation, CSRF and sibling-origin rejection, host-prefixed cookie attributes, money/transfer accounting, duplicate retries, concurrent edits, CSV injection protection, logout/password revocation, persistence and backups.
- `git diff --check`: passed.
- Python tests used the previously installed locked runtime packages through PYTHONPATH because the earlier virtualenv interpreter did not survive the session restart. A new network installation was cancelled; the Python dependency audit could not be completed locally. CI includes pip-audit.
- No local Docker or Nginx executable was available; container build and compose validation are included in CI but have not run here. Nginx syntax and real-browser end-to-end checks remain deployment gates.
- Supabase/provider network calls are mocked in API tests. PGlite runs the PostgreSQL migrations and authorization tests locally. Live Supabase settings, SMTP, microphone devices and provider accounts have not been validated.
- GitHub write access was restored after reconnecting. Imported infrastructure identifiers and prior deployment history were removed before publishing. No production deployment has been performed.
