#!/bin/sh
set -eu
umask 077
python -m flask --app app init-db
exec gunicorn 'app:create_app()' --bind 0.0.0.0:8000 --workers 2 --threads 2 --timeout 30 --worker-tmp-dir /tmp --error-logfile -
