# SpeakSmart AI and SpendWise

SpeakSmart provides email sign-in, ten English practice lessons, authenticated AI chat and speech, saved paragraphs, and profile preferences. SpendWise is the included personal finance tracker under `apps/spendwise`: income, expenses, transfers, monthly budgets, charts, CSV export, and cross-device persistence.

| Application | Intended origin | Authentication | Storage |
| --- | --- | --- | --- |
| SpeakSmart | https://speaksmarts.in | Supabase email/password | Supabase PostgreSQL |
| SpendWise | https://finance.speaksmarts.in | Separate password and host-only session | Separate SQLite volume |

The navigation links the applications. Financial data is never sent to the English tutor. SpendWise currently tracks personal finances, not project billing or investments.

## Development

Use Node.js 24. Copy `.env.example` to `.env.local` and configure only public Supabase values. Copy `.env.server.example` to `.env.server` for server credentials; use `APP_ORIGIN=http://localhost:5173` locally. Never put Groq, Sarvam, or Supabase privileged keys in a `VITE_` variable.

```
npm ci
npm run dev:api
# In a second terminal:
npm run dev
```

Configure Supabase and apply migrations to a fresh staging project first. For a new database, run migrations 000, 001, and 002 in order. Existing databases require the preflight and compatibility review below.

```
npm run validate
npm audit --audit-level=high
cd apps/spendwise
python3 -m venv .venv
.venv/bin/pip install -r requirements.lock
.venv/bin/python -m unittest discover -s tests -v
```

See [deployment instructions](deploy/README.md), [security review](SECURITY.md), and [SpendWise instructions](apps/spendwise/README.md). CI tests both applications, checks dependencies, builds the frontend and finance container, and does not deploy. Configure branch protection to require both jobs and review before merge. Dependabot proposes weekly dependency updates.
