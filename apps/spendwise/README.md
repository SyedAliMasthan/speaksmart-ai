# Spendwise — personal finance tracker

A responsive finance app for your phone and laptop, prepared for deployment to **YOUR_SERVER_IP**. The application has been built and locally tested; it has **not** been installed on this VM. No connection to the VM or cloud-account changes have been made.


## Included

- Expense, income and transfer entry in Indian rupees, with date, category, account, payment method and description.
- Monthly overview, daily spending chart, category breakdown and recent entries.
- Searchable transaction history, month/all-time filters, editing, deletion and CSV export.
- Overall monthly budget and optional category limits. Each month has its own budget.
- One owner login for use on both devices. Password changes revoke all sessions.
- SQLite database stored on the VM in a persistent Docker volume, with backup and restore instructions.
- Mobile layout and home-screen icon/manifest. Browser support determines whether installation or a home-screen shortcut is available.
- All assets served by your VM: no analytics, remote fonts or third-party scripts.

This version records transactions manually. It does not read bank accounts, SMS, UPI apps or credit-card statements. There is no automatic recurring-transaction posting, attachment upload, bank reconciliation or offline entry queue. An Internet connection is needed to read and save transactions.

## How to use it

1. Sign in using the owner account created on the server.
2. Select **Add transaction**, choose Expense, enter the amount and save. The date defaults to today in India.
3. Record income separately. Use Transfer for moving money between your own accounts and for credit-card repayments.
4. Set the overall monthly spending limit under **Budgets**. Category limits are optional and independent of the overall limit.
5. Review the month on **Overview**. Use **Transactions** to search, edit, delete or export entries.
6. On the second device, open the same HTTPS URL and sign in with the same account. Views refresh every 30 seconds while visible, when you return to the app and after a save. An open edit form keeps its original version so conflicting edits are reported.

**Counting rules:** card purchases are expenses when made; repayment of those purchases is a transfer. Loan EMI is an expense under EMI & loan. Account names are labels, not calculated bank balances. Net cash flow means recorded income minus recorded expenses; it is not your bank balance. Refund is currently an income category, so it increases recorded income and does not reduce the original category's spending. To correct an erroneous entry, edit or delete it.

Amounts are stored as integer paise, avoiding floating-point rounding errors. Reports use each entry's chosen date, not the server's timezone. Budgets of 0 mean no limit. Blank data is intentional; no example transactions or previous personal finance details have been inserted.

## VM prerequisites

The VM's OS, SSH username, free capacity and existing web services still need checking. A small personal deployment can start with **2 vCPU, 2 GB RAM and 20 GB persistent disk**; this is a starting configuration, not a measured minimum or a description of your VM.

Required software: a maintained Linux distribution, Docker Engine, Docker Compose plugin and unzip. Both x86_64 and ARM64 are supported by the chosen base images. Installation differs by OS:

- [Docker Engine installation by distribution](https://docs.docker.com/engine/install/)
- [Docker on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [AWS instructions for Docker on Amazon Linux 2023](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-docker.html)
- [Docker Compose plugin installation](https://docs.docker.com/compose/install/linux/)

Before installing anything, run on the VM:

```bash
cat /etc/os-release
uname -m
free -h
df -h /
sudo ss -lntp
docker --version
docker compose version
```

Do not replace an existing web server or bind an occupied port without adapting the deployment. Docker installation is intentionally not performed by the application scripts.

## 1. Copy the package to your VM

Replace `SSH_USER` with the VM's actual SSH username. Use your existing SSH configuration/key; the package contains no credentials.

From your laptop's terminal, in the folder containing the download:

```bash
scp spendwise-aws.zip SSH_USER@YOUR_SERVER_IP:~/
ssh SSH_USER@YOUR_SERVER_IP
```

On the VM, extract into an empty destination:

```bash
unzip spendwise-aws.zip
cd spendwise
```

## 2. Try the app privately first

The default Compose file publishes the app on the VM's loopback interface only. It is not exposed as a public HTTP finance app.

On the VM:

```bash
sudo docker compose build
sudo docker compose run --rm app python -m flask --app app init-db
sudo docker compose run --rm app python -m flask --app app set-password --username syed
sudo docker compose up -d
sudo docker compose ps
```

The password command prompts without echo and requires at least 12 characters. There is no default password and no open registration page.

On your laptop, start a tunnel and leave that terminal open:

```bash
ssh -N -L 8000:127.0.0.1:8000 SSH_USER@YOUR_SERVER_IP
```

Open **http://localhost:8000** on your laptop and sign in. Use exactly `localhost` because request-origin checks are enabled. This HTTP mode is for localhost through an encrypted SSH tunnel. Do not change the loopback binding to `0.0.0.0` to make it public.

## 3. Enable normal mobile and laptop access over HTTPS

The included production configuration uses a DNS hostname you control, such as `finance.yourdomain.com`. Add its DNS A record pointing to **YOUR_SERVER_IP**. If using an existing hostname, check its current use first. If there is an AAAA record, it must also route to this server or be removed for this hostname.

A hostname is needed for this package's default automatic certificate configuration. An IP-only deployment with a publicly trusted certificate is another possible configuration, but is not included or verified here. Do not accept a browser certificate warning to use your real financial data.

In the VM's cloud firewall/security group and host firewall:

| Port | Purpose | Source |
|---|---|---|
| TCP 22 | SSH administration | Your trusted administration IP(s) |
| TCP 80 | Certificate validation and redirect to HTTPS | Internet, for automatic public certificate issuance |
| TCP 443 | App over HTTPS | Devices that will use it; public access supports roaming mobile clients |
| TCP 8000 | App backend | No public inbound rule |

The app requires outbound DNS and HTTPS for normal image installation and certificate operations. The database has no network port. SSH access and firewall changes depend on your actual hosting provider.

Create `.env` and set your real hostname:

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

For example, set `APP_DOMAIN=finance.yourdomain.com` without a scheme, port or trailing slash. The backend origin and Caddy configuration use this same value.

If the private trial is running, stop its containers first. This preserves the data volume:

```bash
sudo docker compose down
```

Start HTTPS mode. This file is standalone; do not merge it with the trial file:

```bash
sudo docker compose -f compose.https.yaml config --quiet
sudo docker compose -f compose.https.yaml build
sudo docker compose -f compose.https.yaml run --rm --no-deps app python -m flask --app app init-db
```

If you did not create the owner during the private trial, create it now:

```bash
sudo docker compose -f compose.https.yaml run --rm --no-deps app python -m flask --app app set-password --username syed
```

Then start and inspect the services:

```bash
sudo docker compose -f compose.https.yaml up -d
sudo docker compose -f compose.https.yaml ps
sudo docker compose -f compose.https.yaml logs --tail=80 caddy
sudo docker compose -f compose.https.yaml logs --tail=80 app
```

Caddy obtains and renews the hostname's TLS certificate and redirects HTTP to HTTPS. [Caddy automatic HTTPS documentation](https://caddyserver.com/docs/automatic-https)

Open your configured HTTPS URL on both devices. On your phone, use the browser's **Add to Home Screen** or **Install app** option where available. The app does not cache finance data for offline use.

Verify after deployment:

1. HTTPS opens without certificate warnings.
2. Login works and an unauthenticated session cannot access transactions.
3. Add a small test expense, confirm it appears on the second device, then delete it.
4. Restart the app container and confirm real entries remain.
5. Create a backup and copy it off the VM.

The application uses Gunicorn behind Caddy; it does not use Flask's development server for VM hosting. [Flask deployment guidance](https://flask.palletsprojects.com/en/stable/deploying/gunicorn/)

## Backup and restore

The persistent volume is **spendwise_finance_data** and contains `/data/spendwise.sqlite3`. Do not run `docker compose down -v`, prune this volume or delete it during an update.

Create a consistent, integrity-checked backup while the app is running:

```bash
sudo bash scripts/backup.sh compose.https.yaml
```

For the private trial, use `sudo bash scripts/backup.sh compose.yaml`. Backups are written to `backups/` with restricted permissions. They contain financial records and password hashes; treat them as private. Live login sessions and login-limit records are removed from each backup.

Copy backups to protected storage outside this VM. A local backup alone does not protect against VM or disk loss. Choose a retention policy before configuring scheduled backups. Do not copy the live SQLite file with `cp`: WAL data may not be included. The supplied script uses SQLite's backup API.

To restore a known backup, first create another backup of the current database. Stop the app so nothing is writing, then restore. Replace the backup filename below with an existing verified backup:

```bash
sudo docker compose -f compose.https.yaml stop app
sudo docker compose -f compose.https.yaml cp backups/YOUR-BACKUP.sqlite3 app:/data/restore.sqlite3
sudo docker compose -f compose.https.yaml run --rm --no-deps --user 0 app python scripts/restore.py /data/restore.sqlite3
sudo docker compose -f compose.https.yaml up -d app
```

The restore script validates the source, uses a SQLite connection to replace the database contents, clears sessions and sets database ownership for the app. It requires the app to be stopped. It does not delete the backup source. Check transaction counts and totals after restoration. Users must sign in again.

## Maintenance

Reset the owner password from the VM:

```bash
sudo docker compose -f compose.https.yaml exec app python -m flask --app app set-password --username syed
```

The same username must be used; this version has one owner. You can also change your password from Account settings in the app.

Before an app update, back up the database and retain the old application package. Replace source files, preserving `.env`, backups and the named volumes, then:

```bash
sudo docker compose -f compose.https.yaml build --pull
sudo docker compose -f compose.https.yaml up -d
sudo docker compose -f compose.https.yaml ps
```

This version initializes schema version 1 idempotently; it has no general migration system. Future releases that change the schema need an explicit migration plan. Do not downgrade across an incompatible schema without restoring the matching backup.

Dependency versions used for local tests are pinned in `requirements.lock`. Review and update them and base images periodically. This is a small personal app on one VM, not a highly available financial system. SQLite is appropriate for this scope; multiple app hosts would require a different database deployment.

## Validation included

Run the backend tests using Python 3.12:

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements.lock
python -m unittest discover -s tests -v
node --check dist/app.js
```

The ten backend tests cover exact paise totals, excluded transfers, month filtering, retry deduplication, second-device reads, edit conflicts, authentication, CSRF and origin checks, user isolation, malformed data, category and overall budgets, search, safe CSV exports, logout, rate limits, password revocation, restart persistence and SQLite backup integrity.

**Completed locally:** 10 backend tests passed; Python and JavaScript syntax checks; static asset and manifest checks. **Not performed here:** browser/visual testing, Docker image build/runtime testing, TLS issuance, VM capacity verification or live deployment. Verify these on the VM before relying on it for daily use.

## Project files

| File | Purpose |
|---|---|
| `app.py`, `schema.sql` | Flask API, login, money validation and SQLite tables |
| `dist/` | Responsive app interface, styles, icons and manifest |
| `Dockerfile`, `requirements.lock` | Container and exact Python dependency versions |
| `compose.yaml` | Private localhost/SSH-tunnel trial |
| `compose.https.yaml`, `Caddyfile`, `.env.example` | Hostname-based HTTPS deployment |
| `scripts/` | Startup, consistent backup and stopped-app restoration |
| `tests/test_app.py` | Backend regression tests |
