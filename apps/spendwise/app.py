"""Spendwise: a small, single-VM finance tracker. Amounts are integer paise."""
import calendar
import csv
import hashlib
import hmac
import io
import os
import re
import secrets
import sqlite3
import time
import uuid
from datetime import date
from decimal import Decimal
from functools import wraps
from pathlib import Path
from urllib.parse import urlsplit

import click
from flask import Flask, Response, g, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix

ROOT = Path(__file__).resolve().parent
EXPENSES = ['Groceries', 'Food & dining', 'Transport', 'Shopping', 'Bills & utilities',
            'Rent', 'EMI & loan', 'Education', 'Health', 'Entertainment', 'Travel', 'Other']
INCOME = ['Salary', 'Business', 'Interest', 'Gift', 'Refund', 'Other income']
METHODS = ['UPI', 'Cash', 'Debit card', 'Credit card', 'Bank transfer', 'Other']


def create_app(config=None):
    app = Flask(__name__, static_folder=None)
    app.config.update(
        DATABASE=os.environ.get('DATABASE_PATH', str(ROOT / 'data' / 'spendwise.sqlite3')),
        PUBLIC_ORIGIN=os.environ.get('PUBLIC_ORIGIN', 'http://localhost:8000').rstrip('/'),
        COOKIE_SECURE=os.environ.get('COOKIE_SECURE', 'true').lower() == 'true',
        MAX_CONTENT_LENGTH=16 * 1024,
    )
    if config:
        app.config.update(config)
    origin = urlsplit(app.config['PUBLIC_ORIGIN'])
    if origin.scheme not in ('https', 'http') or not origin.hostname or origin.path not in ('', '/') or origin.username or origin.password or origin.query or origin.fragment:
        raise RuntimeError('PUBLIC_ORIGIN must be an http(s) origin without a path.')
    if not app.config['COOKIE_SECURE'] and origin.hostname not in ('localhost', '127.0.0.1', '::1') and not app.config.get('TESTING'):
        raise RuntimeError('Insecure cookies are permitted only on localhost.')
    app.config['SESSION_COOKIE_NAME'] = '__Host-spendwise_session' if app.config['COOKIE_SECURE'] else 'spendwise_session'
    if app.config['COOKIE_SECURE'] and origin.scheme != 'https' and not app.config.get('TESTING'):
        raise RuntimeError('Set PUBLIC_ORIGIN to your HTTPS URL. For localhost only, set COOKIE_SECURE=false.')
    app.config['TRUSTED_HOSTS'] = [origin.hostname, 'localhost', '127.0.0.1']
    # Enable only behind the bundled, sole Caddy proxy. Never expose app:8000 publicly.
    if os.environ.get('TRUST_PROXY') == '1':
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

    def db():
        if 'db' not in g:
            g.db = sqlite3.connect(app.config['DATABASE'], timeout=15)
            g.db.row_factory = sqlite3.Row
            g.db.execute('PRAGMA foreign_keys=ON')
        return g.db

    @app.teardown_appcontext
    def close_db(_):
        con = g.pop('db', None)
        if con is not None:
            con.close()

    def fail(message, code=400):
        return jsonify(error=message), code

    @app.before_request
    def guard():
        if request.path.startswith('/api/') and request.method not in ('GET', 'HEAD', 'OPTIONS'):
            if request.headers.get('Origin') != app.config['PUBLIC_ORIGIN']:
                return fail('This request did not come from your app. Reload and try again.', 403)
            if request.headers.get('Sec-Fetch-Site') == 'cross-site':
                return fail('Cross-site request blocked.', 403)
            if not request.is_json:
                return fail('Send JSON data.', 415)

    @app.after_request
    def headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['Cross-Origin-Resource-Policy'] = 'same-origin'
        response.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
        response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; connect-src 'self'; font-src 'self'; "
            "object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
        )
        if app.config['COOKIE_SECURE']:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000'
        if request.path.startswith('/api/') or request.path == '/':
            response.headers['Cache-Control'] = 'no-store'
        return response

    @app.errorhandler(HTTPException)
    def http_error(e):
        return fail(e.description, e.code)

    @app.errorhandler(sqlite3.Error)
    def storage_error(e):
        app.logger.exception('Database operation failed')
        return fail('Your data could not be accessed. Please try again.', 503)

    def current_session():
        token = request.cookies.get(app.config['SESSION_COOKIE_NAME'], '')
        if not re.fullmatch(r'[A-Za-z0-9_-]{43}', token):
            return None
        return db().execute(
            'SELECT s.*, u.username FROM sessions s JOIN users u ON u.id=s.user_id '
            'WHERE token_hash=? AND expires>?',
            (hashlib.sha256(token.encode()).hexdigest(), int(time.time()))
        ).fetchone()

    def protected(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            g.auth = current_session()
            if g.auth is None:
                return fail('Please sign in to continue.', 401)
            if request.method not in ('GET', 'HEAD') and not hmac.compare_digest(
                request.headers.get('X-CSRF-Token', ''), g.auth['csrf']
            ):
                return fail('Your session changed. Reload and try again.', 403)
            return fn(*args, **kwargs)
        return wrapped

    def body():
        value = request.get_json(silent=True)
        if not isinstance(value, dict):
            raise ValueError('Enter valid form data.')
        return value

    def text_value(data, key, limit=100, required=True):
        val = data.get(key, '')
        if not isinstance(val, str) or len(val) > limit or any(ord(c) < 32 for c in val):
            raise ValueError(f'Check the {key.replace("_", " ")} field.')
        val = val.strip()
        if required and not val:
            raise ValueError(f'Enter {key.replace("_", " ")}.')
        return val

    def amount_value(val, allow_zero=False):
        if not isinstance(val, str) or not re.fullmatch(r'\d{1,9}(\.\d{1,2})?', val):
            raise ValueError('Enter an amount with up to two decimal places.')
        paise = int(Decimal(val) * 100)
        if paise < (0 if allow_zero else 1):
            raise ValueError('Amount must be greater than zero.')
        return paise

    def month_value(val):
        if not isinstance(val, str) or not re.fullmatch(r'\d{4}-\d{2}', val):
            raise ValueError('Choose a valid month.')
        date.fromisoformat(val + '-01')
        return val

    def parse_transaction(data):
        day = text_value(data, 'day', 10)
        if date.fromisoformat(day).isoformat() != day:
            raise ValueError('Choose a valid date.')
        kind = text_value(data, 'kind', 20)
        category = text_value(data, 'category', 40)
        if kind not in ('expense', 'income', 'transfer'):
            raise ValueError('Choose an entry type.')
        allowed = EXPENSES if kind == 'expense' else INCOME if kind == 'income' else ['Transfer', 'Credit-card repayment']
        if category not in allowed:
            raise ValueError('Choose a valid category.')
        amount = amount_value(data.get('amount'))
        account = text_value(data, 'account', 60)
        target = text_value(data, 'to_account', 60, required=kind == 'transfer') if kind == 'transfer' else ''
        if kind == 'transfer' and account.casefold() == target.casefold():
            raise ValueError('Choose two different accounts for a transfer.')
        method = text_value(data, 'method', 30)
        if method not in METHODS:
            raise ValueError('Choose a payment method.')
        return (day, kind, amount, category, text_value(data, 'description', 240, False), account, target, method)

    @app.get('/')
    def index():
        return send_from_directory(ROOT / 'dist', 'index.html')

    @app.get('/<path:filename>')
    def static_file(filename):
        return send_from_directory(ROOT / 'dist', filename)

    @app.get('/healthz')
    def health():
        db().execute('SELECT 1 FROM users LIMIT 1')
        return jsonify(status='ok')

    @app.post('/api/login')
    def login():
        try:
            data = body()
            username = text_value(data, 'username', 60).casefold()
            password = data.get('password', '')
            if not isinstance(password, str) or len(password) > 256:
                raise ValueError('Check your sign-in details.')
        except ValueError as exc:
            return fail(str(exc))
        now = int(time.time())
        ip = request.remote_addr or 'unknown'
        buckets = [('ip:' + ip, 40), ('user:' + username, 10)]
        con = db()
        with con:
            con.execute('BEGIN IMMEDIATE')
            con.execute('DELETE FROM login_limits WHERE expires<=?', (now,))
            con.execute('DELETE FROM sessions WHERE expires<=?', (now,))
            for bucket, limit in buckets:
                row = con.execute('SELECT attempts FROM login_limits WHERE bucket=?', (bucket,)).fetchone()
                if row and row['attempts'] >= limit:
                    response = jsonify(error='Too many sign-in attempts. Try again in 15 minutes.')
                    response.status_code = 429
                    response.headers['Retry-After'] = '900'
                    return response
            for bucket, _ in buckets:
                con.execute('INSERT INTO login_limits VALUES (?,1,?) ON CONFLICT(bucket) '
                            'DO UPDATE SET attempts=attempts+1', (bucket, now + 900))
        user = con.execute('SELECT * FROM users WHERE username=?', (username,)).fetchone()
        # Always perform a password hash check to avoid a fast unknown-user path.
        valid = check_password_hash(user['password_hash'] if user else app.config['DUMMY_HASH'], password)
        if not user or not valid:
            return fail('Username or password is incorrect.', 401)
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        with con:
            con.execute('BEGIN IMMEDIATE')
            current_hash = con.execute('SELECT password_hash FROM users WHERE id=?', (user['id'],)).fetchone()
            if not current_hash or current_hash['password_hash'] != user['password_hash']:
                return fail('Your password changed. Please sign in again.', 401)
            con.execute('DELETE FROM login_limits WHERE bucket=?', ('user:' + username,))
            con.execute('INSERT INTO sessions VALUES (?,?,?,?)',
                        (hashlib.sha256(token.encode()).hexdigest(), user['id'], csrf, now + 43200))
        response = jsonify(username=user['username'], csrf=csrf)
        response.set_cookie(app.config['SESSION_COOKIE_NAME'], token, max_age=43200, secure=app.config['COOKIE_SECURE'],
                            httponly=True, samesite='Strict', path='/')
        return response

    @app.get('/api/session')
    @protected
    def session_info():
        return jsonify(username=g.auth['username'], csrf=g.auth['csrf'], categories=EXPENSES,
                       income_categories=INCOME, methods=METHODS)

    @app.post('/api/logout')
    @protected
    def logout():
        with db():
            db().execute('DELETE FROM sessions WHERE token_hash=?', (g.auth['token_hash'],))
        response = jsonify(ok=True)
        response.delete_cookie(app.config['SESSION_COOKIE_NAME'], path='/', secure=app.config['COOKIE_SECURE'],
                               httponly=True, samesite='Strict')
        return response

    @app.post('/api/password')
    @protected
    def password_change():
        try:
            data = body()
            password = data.get('new_password', '')
            old = data.get('current_password', '')
            if not isinstance(old, str) or len(old) > 256:
                raise ValueError('Enter your current password.')
            if not isinstance(password, str) or not 12 <= len(password) <= 256:
                raise ValueError('Use a password between 12 and 256 characters.')
            user = db().execute('SELECT * FROM users WHERE id=?', (g.auth['user_id'],)).fetchone()
            if not check_password_hash(user['password_hash'], old):
                return fail('Current password is incorrect.', 400)
            with db():
                db().execute('UPDATE users SET password_hash=? WHERE id=?',
                             (generate_password_hash(password), g.auth['user_id']))
                db().execute('DELETE FROM sessions WHERE user_id=?', (g.auth['user_id'],))
            response = jsonify(ok=True)
            response.delete_cookie(app.config['SESSION_COOKIE_NAME'], path='/', secure=app.config['COOKIE_SECURE'], httponly=True, samesite='Strict')
            return response
        except ValueError as exc:
            return fail(str(exc))

    def query_filters():
        clauses, params = ['user_id=?'], [g.auth['user_id']]
        month = request.args.get('month', '')
        if month:
            month_value(month)
            clauses += ['day>=?', 'day<=?']
            params += [month + '-01', month + '-31']
        kind = request.args.get('kind', '')
        category = request.args.get('category', '')
        search = request.args.get('q', '').strip()[:100]
        if kind:
            if kind not in ('expense', 'income', 'transfer'):
                raise ValueError('Choose a valid entry type.')
            clauses.append('kind=?')
            params.append(kind)
        if category:
            clauses.append('category=?')
            params.append(category)
        if search:
            clauses.append("(instr(lower(description), lower(?))>0 OR instr(lower(account), lower(?))>0 OR instr(lower(category), lower(?))>0)")
            params += [search] * 3
        return ' AND '.join(clauses), params

    @app.get('/api/transactions')
    @protected
    def transactions():
        try:
            where, params = query_filters()
            page = int(request.args.get('page', '1'))
            if page < 1 or page > 1000000:
                raise ValueError('Choose a valid page.')
            rows = db().execute(f'SELECT * FROM transactions WHERE {where} ORDER BY day DESC, created_at DESC, id DESC LIMIT 50 OFFSET ?', params + [(page - 1) * 50])
            count = db().execute(f'SELECT count(*) FROM transactions WHERE {where}', params).fetchone()[0]
            return jsonify(items=[dict(r) for r in rows], total=count, page=page, page_size=50)
        except ValueError as exc:
            return fail(str(exc))

    @app.post('/api/transactions')
    @protected
    def add_transaction():
        try:
            data = body()
            entry_id = str(uuid.UUID(text_value(data, 'id', 36)))
            values = parse_transaction(data)
        except (ValueError, TypeError) as exc:
            return fail(str(exc))
        fields = ('day', 'kind', 'amount', 'category', 'description', 'account', 'to_account', 'method')
        with db():
            db().execute('INSERT INTO transactions '
                         '(id,user_id,day,kind,amount,category,description,account,to_account,method) '
                         'VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',
                         (entry_id, g.auth['user_id'], *values))
            row = db().execute('SELECT * FROM transactions WHERE id=? AND user_id=?', (entry_id, g.auth['user_id'])).fetchone()
            if row is None or tuple(row[k] for k in fields) != values:
                return fail('This entry was already saved with different details. Reload the transactions list.', 409)
        return jsonify(item=dict(row)), 201

    @app.put('/api/transactions/<entry_id>')
    @protected
    def edit_transaction(entry_id):
        try:
            data = body()
            values = parse_transaction(data)
            version = data.get('version')
            if type(version) is not int or version < 1:
                raise ValueError('Reload this entry before editing.')
        except ValueError as exc:
            return fail(str(exc))
        with db():
            changed = db().execute('UPDATE transactions SET day=?,kind=?,amount=?,category=?,description=?,account=?,to_account=?,method=?,version=version+1 '
                                   'WHERE id=? AND user_id=? AND version=?', (*values, entry_id, g.auth['user_id'], version)).rowcount
            if not changed:
                return fail('This entry has changed or was deleted on another device. Close it and refresh before editing.', 409)
        return jsonify(ok=True)

    @app.delete('/api/transactions/<entry_id>')
    @protected
    def delete_transaction(entry_id):
        try:
            version = body().get('version')
            if type(version) is not int:
                raise ValueError('Reload this entry before deleting.')
        except ValueError as exc:
            return fail(str(exc))
        with db():
            changed = db().execute('DELETE FROM transactions WHERE id=? AND user_id=? AND version=?',
                                   (entry_id, g.auth['user_id'], version)).rowcount
            if not changed:
                return fail('This entry has changed or was deleted. Refresh and try again.', 409)
        return jsonify(ok=True)

    @app.get('/api/summary')
    @protected
    def summary():
        try:
            month = month_value(request.args.get('month'))
        except (ValueError, TypeError):
            return fail('Choose a valid month.')
        params = (g.auth['user_id'], month + '-01', month + '-31')
        totals = {r['kind']: r['amount'] for r in db().execute(
            'SELECT kind,SUM(amount) amount FROM transactions WHERE user_id=? AND day BETWEEN ? AND ? GROUP BY kind', params)}
        categories = [dict(r) for r in db().execute(
            "SELECT category,SUM(amount) amount FROM transactions WHERE user_id=? AND day BETWEEN ? AND ? AND kind='expense' GROUP BY category ORDER BY amount DESC", params)]
        daily = {r['day']: r['amount'] for r in db().execute(
            "SELECT day,SUM(amount) amount FROM transactions WHERE user_id=? AND day BETWEEN ? AND ? AND kind='expense' GROUP BY day", params)}
        budgets = {r['category']: r['amount'] for r in db().execute(
            'SELECT category,amount FROM budgets WHERE user_id=? AND month=?', (g.auth['user_id'], month))}
        return jsonify(month=month, expense=totals.get('expense', 0), income=totals.get('income', 0),
                       transfer=totals.get('transfer', 0), net=totals.get('income', 0) - totals.get('expense', 0),
                       categories=categories, daily=daily, budgets=budgets,
                       days=calendar.monthrange(int(month[:4]), int(month[5:]))[1])

    @app.put('/api/budgets')
    @protected
    def save_budget():
        try:
            data = body()
            month = month_value(data.get('month'))
            category = data.get('category')
            if category not in ['Overall', *EXPENSES]:
                raise ValueError('Choose a valid category.')
            amount = amount_value(data.get('amount'), True)
        except (ValueError, TypeError) as exc:
            return fail(str(exc))
        with db():
            db().execute('INSERT INTO budgets VALUES (?,?,?,?) ON CONFLICT(user_id,month,category) DO UPDATE SET amount=excluded.amount',
                         (g.auth['user_id'], month, category, amount))
        return jsonify(ok=True)

    @app.get('/api/export.csv')
    @protected
    def export():
        try:
            where, params = query_filters()
        except ValueError as exc:
            return fail(str(exc))
        stream = io.StringIO(newline='')
        writer = csv.writer(stream)
        writer.writerow(['Date', 'Type', 'Amount INR', 'Category', 'Description', 'Account', 'To account', 'Payment method', 'ID'])
        for row in db().execute(f'SELECT * FROM transactions WHERE {where} ORDER BY day,created_at', params):
            cells = [row['day'], row['kind'], format(Decimal(row['amount']) / 100, '.2f'), row['category'],
                     row['description'], row['account'], row['to_account'], row['method'], row['id']]
            writer.writerow(["'" + cell if cell and cell[0] in '=+-@\t\r\n' else cell for cell in cells])
        return Response('\ufeff' + stream.getvalue(), mimetype='text/csv', headers={
            'Content-Disposition': 'attachment; filename="spendwise-transactions.csv"'})

    @app.cli.command('init-db')
    def init_db():
        path = Path(app.config['DATABASE'])
        path.parent.mkdir(parents=True, exist_ok=True)
        os.umask(0o077)
        with sqlite3.connect(path) as con:
            con.execute('PRAGMA journal_mode=WAL')
            con.executescript((ROOT / 'schema.sql').read_text())
        os.chmod(path, 0o600)
        click.echo('Database ready.')

    @app.cli.command('set-password')
    @click.option('--username', prompt=True)
    @click.password_option(confirmation_prompt=True)
    def set_password(username, password):
        """Create the owner account or reset its password. All sessions are revoked."""
        username = username.strip().casefold()
        if not re.fullmatch(r'[a-z0-9_.@-]{3,60}', username):
            raise click.ClickException('Use 3-60 letters, numbers or _.@- for username.')
        if not 12 <= len(password) <= 256:
            raise click.ClickException('Use a password between 12 and 256 characters.')
        with db():
            # A single owner account is intended. The data schema still scopes every row by user.
            existing = db().execute('SELECT username FROM users LIMIT 1').fetchone()
            if existing and existing['username'].casefold() != username:
                raise click.ClickException('An owner already exists. Use that username to reset the password.')
            db().execute('INSERT INTO users(username,password_hash) VALUES (?,?) '
                         'ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash',
                         (username, generate_password_hash(password)))
            user = db().execute('SELECT id FROM users WHERE username=?', (username,)).fetchone()
            db().execute('DELETE FROM sessions WHERE user_id=?', (user['id'],))
        click.echo('Owner password saved. Sign in on your phone or laptop.')

    app.config['DUMMY_HASH'] = generate_password_hash(secrets.token_urlsafe(32))
    return app
