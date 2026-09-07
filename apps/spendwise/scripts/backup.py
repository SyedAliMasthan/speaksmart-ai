"""Create a consistent SQLite backup through the SQLite backup API.

Run in the app container: python scripts/backup.py /tmp/finance-backup.sqlite3
This contains private finance data and password hashes; keep it protected.
"""
import os
import sqlite3
import sys
from pathlib import Path

def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python scripts/backup.py /absolute/new-backup.sqlite3')
    source = Path(os.environ.get('DATABASE_PATH', '/data/spendwise.sqlite3'))
    dest = Path(sys.argv[1])
    if not dest.is_absolute():
        raise SystemExit('Use an absolute destination path.')
    if not source.is_file():
        raise SystemExit('Source database does not exist.')
    # Exclusive creation prevents accidentally overwriting an existing backup.
    fd = os.open(dest, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    try:
        with sqlite3.connect(source.resolve().as_uri() + '?mode=ro', uri=True) as src:
            with sqlite3.connect(dest) as target:
                src.backup(target)
                target.execute('DELETE FROM sessions')
                target.execute('DELETE FROM login_limits')
                if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                    raise RuntimeError('Backup integrity check failed.')
        print('Backup created and verified: ' + str(dest))
    except Exception:
        dest.unlink(missing_ok=True)
        raise

if __name__ == '__main__':
    main()
