#!/usr/bin/env bash
set -euo pipefail
umask 077
cd -- "$(dirname -- "$0")/.."
compose_file="${1:-compose.https.yaml}"
mkdir -p backups
backup_name="spendwise-$(date -u +%Y%m%dT%H%M%SZ)-$$.sqlite3"
docker compose -f "$compose_file" exec -T app python scripts/backup.py "/tmp/$backup_name"
docker compose -f "$compose_file" cp "app:/tmp/$backup_name" "backups/$backup_name"
chmod 600 "backups/$backup_name"
docker compose -f "$compose_file" exec -T app python -c 'from pathlib import Path; import sys; Path(sys.argv[1]).unlink()' "/tmp/$backup_name"
printf 'Backup saved: %s\n' "backups/$backup_name"
