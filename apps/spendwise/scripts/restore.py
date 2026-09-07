"""Restore an offline app database. Stop the app before running this command."""
import os
from pathlib import Path
import sqlite3
import sys

def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python scripts/restore.py /absolute/backup.sqlite3')
    source = Path(sys.argv[1]).resolve()
    destination = Path(os.environ.get('DATABASE_PATH', '/data/spendwise.sqlite3')).resolve()
    if not source.is_file() or source == destination:
        raise SystemExit('Use a separate existing backup file.')
    os.umask(0o077)
    with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as src:
        if src.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise SystemExit('Source backup failed integrity check.')
        version = src.execute('PRAGMA user_version').fetchone()[0]
        if version != 1:
            raise SystemExit('Expected a Spendwise schema version 1 backup.')
        tables = {r[0] for r in src.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not {'users','sessions','transactions','budgets','login_limits'} <= tables:
            raise SystemExit('Not a Spendwise backup.')
        with sqlite3.connect(destination) as target:
            src.backup(target)
            target.execute('DELETE FROM sessions')
            target.execute('DELETE FROM login_limits')
        with sqlite3.connect(destination) as target:
            target.execute('PRAGMA wal_checkpoint(TRUNCATE)')
    for file in [destination,Path(str(destination)+'-wal'),Path(str(destination)+'-shm')]:
        if file.exists():
            os.chmod(file,0o600)
            if os.geteuid()==0:
                # Native runs may use a different UID; the supplied container uses 10001.
                os.chown(file,int(os.environ.get('RESTORE_UID','10001')),int(os.environ.get('RESTORE_GID','10001')))
    print('Database restored. Start the app and verify your totals.')

if __name__=='__main__':
    main()
