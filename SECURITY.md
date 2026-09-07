# Security review and change scope

The reviewed source exposed AI provider keys through Vite browser variables and had missing authentication/page modules. Its SECURITY DEFINER export/delete functions used a nullable comparison and did not revoke default PUBLIC execution. Nginx proxied to an unspecified backend and lost security headers in locations declaring their own headers.

Read-only inspection of the live Lianna pages showed localStorage-based sign-in, a disabled chat auth check, and HTML insertion of message text. The live backend and deployed database permissions were not tested. These observations do not establish that the replacement React source is currently deployed.

This branch introduces server-validated confirmed-user authentication, bounded input/output, fixed provider destinations, persistent per-user quotas, React text rendering, null-safe database ownership checks, least-privilege routine execution, and isolated finance sessions. It repairs missing sign-in, recovery, dashboard, lesson and profile workflows. Tests exercise access boundaries and real PostgreSQL semantics through PGlite; provider calls are mocked.

This is a targeted source review, not a complete penetration test or a guarantee against vulnerabilities. Production schema compatibility, existing policies, real browser flows, provider accounts, proxy settings, container runtime and OpenShift controls need staging validation. No Indian Bank systems were tested or modified.

Report security issues privately to the repository owner. Do not include passwords, tokens, recordings or financial records in public issues. If provider keys were ever deployed in browser bundles, revoke and replace them before release; source cleanup alone is insufficient.
