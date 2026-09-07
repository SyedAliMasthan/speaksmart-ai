#!/usr/bin/env bash
# Run from the extracted package: sudo bash scripts/install-ubuntu.sh
# --check prints preflight information without making system changes.
set -euo pipefail
umask 027

target_ip="${TARGET_IP:?Set TARGET_IP to your server IPv4 address}"
finance_domain="${APP_DOMAIN:?Set APP_DOMAIN to your finance hostname}"
install_dir='/opt/spendwise'
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
fail() { printf '\nSetup stopped: %s\n' "$*" >&2; exit 1; }
stage='preflight'
trap 'printf "\nSetup stopped during %s (line %s). Review the error above. Existing data volumes are retained.\n" "$stage" "$LINENO" >&2' ERR

[[ -r /etc/os-release ]] || fail 'Cannot identify this operating system.'
. /etc/os-release
[[ "$ID" == 'ubuntu' ]] || fail 'This installer is for Ubuntu.'
case "$VERSION_ID" in 22.04|24.04|26.04) ;; *) fail "Ubuntu $VERSION_ID requires a reviewed Docker installation; supported by this script: 22.04, 24.04, 26.04." ;; esac

printf 'Target: %s (%s)\nOS: %s\n' "$finance_domain" "$target_ip" "$PRETTY_NAME"
printf '\nMemory and disk:\n'
free -h
df -h /
printf '\nCurrent web/backend listeners:\n'
ss -lntp '( sport = :80 or sport = :443 or sport = :8000 )'
printf '\nFinance hostname IPv4 resolution:\n'
resolved_ips="$(getent ahostsv4 "$finance_domain" | awk '{print $1}' | sort -u || true)"
printf '%s\n' "${resolved_ips:-No IPv4 address resolved}"

if [[ "${1:-}" == '--check' ]]; then
    printf '\nPreflight only. No installation or firewall changes made.\n'
    exit 0
fi
[[ $# -eq 0 ]] || fail 'Usage: sudo bash scripts/install-ubuntu.sh [--check]'
[[ $EUID -eq 0 ]] || fail 'Run with sudo.'
printf '%s\n' "$resolved_ips" | grep -Fxq "$target_ip" || fail "Create a DNS A record: finance -> $target_ip, then rerun. Use DNS-only mode initially if your DNS provider offers proxying."
[[ "$(printf '%s\n' "$resolved_ips" | wc -l)" -eq 1 ]] || fail 'The hostname has multiple IPv4 targets. Review DNS before installation.'

if [[ -d "$install_dir" && ! -f "$install_dir/.spendwise-managed" ]]; then
    fail "$install_dir already exists and was not created by this installer. Review it before proceeding."
fi

stage='Docker prerequisites'
if command -v docker >/dev/null 2>&1; then
    docker info >/dev/null 2>&1 || fail 'Docker is installed but not reachable. Check its service before continuing.'
    docker compose version >/dev/null 2>&1 || fail 'Install the Docker Compose plugin for your existing Docker installation, then rerun.'
else
    for pkg in docker.io docker-compose docker-compose-v2 docker-doc podman-docker containerd runc; do
        status="$(dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null || true)"
        [[ "$status" != 'install ok installed' ]] || fail "Existing package $pkg needs review before installing Docker CE. Nothing has been removed."
    done
    apt-get update
    apt-get install -y ca-certificates curl
    install -m 0755 -d /etc/apt/keyrings
    curl --fail --show-error --silent --location https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    architecture="$(dpkg --print-architecture)"
    cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $VERSION_CODENAME
Components: stable
Architectures: $architecture
Signed-By: /etc/apt/keyrings/docker.asc
EOF
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
fi
command -v curl >/dev/null 2>&1 || apt-get install -y curl ca-certificates

stage='application files'
install -d -m 0750 "$install_dir"
if [[ "$source_dir" != "$install_dir" ]]; then
    # Copy only application files. Uploaded keys, .env, live data and backups
    # are never copied by this installer.
    for item in app.py schema.sql Dockerfile requirements.lock requirements.txt dist scripts proxy compose.yaml compose.https.yaml compose.proxy.yaml Caddyfile .dockerignore .env.example README.md UBUNTU-SETUP.md; do
        [[ -e "$source_dir/$item" ]] || fail "Package is missing $item."
        cp -a -- "$source_dir/$item" "$install_dir/"
    done
fi
touch "$install_dir/.spendwise-managed"
chown -R root:root "$install_dir/scripts" "$install_dir/proxy"
chmod -R go-w "$install_dir/scripts" "$install_dir/proxy"
cd -- "$install_dir"
if [[ -f .env ]]; then
    grep -Fxq "APP_DOMAIN=$finance_domain" .env || fail 'Existing .env uses a different hostname. Review it before continuing.'
else
    printf 'APP_DOMAIN=%s\n' "$finance_domain" > .env
    chmod 600 .env
fi

stage='deployment mode'
managed_caddy="$(docker ps -q --filter label=com.docker.compose.project=spendwise --filter label=com.docker.compose.service=caddy)"
managed_app="$(docker ps -q --filter label=com.docker.compose.project=spendwise --filter label=com.docker.compose.service=app)"
web_listeners="$(ss -H -lnt '( sport = :80 or sport = :443 )')"
backend_listeners="$(ss -H -lnt '( sport = :8000 )')"
if [[ -n "$backend_listeners" && -z "$managed_app" ]]; then
    fail 'Port 8000 is already used by another service. Review its owner before choosing an app port.'
fi
if [[ -n "$web_listeners" && -z "$managed_caddy" ]]; then
    compose_file='compose.proxy.yaml'
    printf '\nAn existing web server owns ports 80/443. Starting only the private backend.\n'
else
    compose_file='compose.https.yaml'
fi
printf '%s\n' "$compose_file" > .deployment-mode
docker compose -f "$compose_file" config --quiet

stage='application build and login'
docker compose -f "$compose_file" build
docker compose -f "$compose_file" run --rm --no-deps app python -m flask --app app init-db
owner_count="$(docker compose -f "$compose_file" run --rm --no-deps -T app python -c 'import os,sqlite3; print(sqlite3.connect(os.environ["DATABASE_PATH"]).execute("SELECT count(*) FROM users").fetchone()[0])')"
if [[ "$owner_count" == '0' ]]; then
    printf '\nCreate your Spendwise password (minimum 12 characters).\n'
    docker compose -f "$compose_file" run --rm --no-deps app python -m flask --app app set-password --username syed
fi

if [[ "$compose_file" == 'compose.https.yaml' ]] && command -v ufw >/dev/null 2>&1 && ufw status | grep -q '^Status: active'; then
    stage='web firewall rules'
    ufw allow 80/tcp comment 'Spendwise HTTPS certificate validation'
    ufw allow 443/tcp comment 'Spendwise HTTPS'
fi

stage='application startup'
docker compose -f "$compose_file" up -d --wait --wait-timeout 180
docker compose -f "$compose_file" ps
if [[ "$compose_file" == 'compose.proxy.yaml' ]]; then
    curl --fail --show-error --silent http://127.0.0.1:8000/healthz
    printf '\n\nBackend is healthy. PUBLIC HTTPS SETUP IS STILL REQUIRED.\n'
    printf 'Add the finance subdomain to your existing web server using the appropriate example:\n'
    printf '  %s/proxy/Caddyfile.finance\n  %s/proxy/nginx-finance.conf\n' "$install_dir" "$install_dir"
    printf 'Review its current configuration and certificate method before enabling the new virtual host.\n'
    printf 'Do not open TCP 8000 publicly. Refer to UBUNTU-SETUP.md.\n'
    exit 0
fi

stage='HTTPS verification'
if curl --fail --show-error --silent --connect-timeout 5 --max-time 12 --retry 8 --retry-all-errors --retry-delay 5 "https://$finance_domain/healthz"; then
    printf '\n\nSpendwise is responding at https://%s\nUsername: syed\n' "$finance_domain"
    printf 'Sign in on your phone and laptop, add a test entry, then verify it on both devices.\n'
else
    printf '\nApp started, but public HTTPS verification failed. Deployment is not yet verified.\n' >&2
    printf 'Check cloud firewall TCP 80/443, DNS/AAAA records and the logs below.\n' >&2
    docker compose -f "$compose_file" logs --tail=50 caddy
    exit 1
fi
