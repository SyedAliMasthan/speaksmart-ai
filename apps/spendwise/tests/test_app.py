"""Meaningful API checks: money, persistence, authentication and cross-device edits."""
import csv
import io
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from app import create_app
from werkzeug.security import generate_password_hash

PASSWORD = 'only-for-local-tests-123'
ORIGIN = 'https://finance.test'

class FinanceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.tmp.name) / 'finance.sqlite3')
        self.app = create_app({'TESTING':True, 'DATABASE':self.path, 'PUBLIC_ORIGIN':ORIGIN, 'COOKIE_SECURE':True})
        result = self.app.test_cli_runner().invoke(args=['init-db'])
        self.assertEqual(result.exit_code, 0, result.output)
        with sqlite3.connect(self.path) as db:
            db.execute('INSERT INTO users VALUES (1,?,?)', ('syed', generate_password_hash(PASSWORD)))
            db.execute('INSERT INTO users VALUES (2,?,?)', ('other', generate_password_hash(PASSWORD)))
        self.client = self.app.test_client()
        self.csrf = self.login(self.client)

    def tearDown(self):
        self.tmp.cleanup()

    def login(self, client, username='syed'):
        result = client.post('/api/login', base_url=ORIGIN, json={'username':username,'password':PASSWORD},headers={'Origin':ORIGIN})
        self.assertEqual(result.status_code, 200, result.json)
        return result.json['csrf']

    def mutate(self, method, path, data, client=None, csrf=None):
        return getattr(client or self.client, method)(path, base_url=ORIGIN, json=data, headers={'Origin':ORIGIN,'X-CSRF-Token':csrf or self.csrf})

    def get(self, path, client=None):
        return (client or self.client).get(path,base_url=ORIGIN)

    def entry(self, **overrides):
        return dict(id=str(uuid.uuid4()),day='2026-09-06',kind='expense',amount='250.25',category='Groceries',
                    description='Weekly groceries',account='Bank',to_account='',method='UPI',**{}) | overrides

    def test_host_cookie_and_sibling_origin(self):
        response = self.client.post('/api/login', base_url=ORIGIN, json={'username':'syed','password':PASSWORD}, headers={'Origin':ORIGIN})
        cookie = response.headers['Set-Cookie']
        self.assertTrue(cookie.startswith('__Host-spendwise_session='))
        for flag in ['Secure', 'HttpOnly', 'Path=/']:
            self.assertIn(flag, cookie)
        self.assertNotIn('Domain=', cookie)
        response = self.client.post('/api/transactions', base_url=ORIGIN, json=self.entry(), headers={'Origin':'https://speaksmarts.in','X-CSRF-Token':response.json['csrf']})
        self.assertEqual(response.status_code, 403)

    def test_money_totals_exclude_transfers_and_other_months(self):
        for data in [self.entry(amount='0.10'),self.entry(amount='0.20'),self.entry(kind='income',amount='100.00',category='Salary'),
                     self.entry(kind='transfer',amount='75',category='Credit-card repayment',to_account='Card'),self.entry(day='2026-08-31',amount='500')]:
            self.assertEqual(self.mutate('post','/api/transactions',data).status_code,201)
        s=self.get('/api/summary?month=2026-09').json
        self.assertEqual((s['expense'],s['income'],s['net'],s['transfer']),(30,10000,9970,7500))

    def test_duplicate_retry_and_conflicting_retry(self):
        data=self.entry()
        for _ in range(2):self.assertEqual(self.mutate('post','/api/transactions',data).status_code,201)
        self.assertEqual(self.get('/api/transactions').json['total'],1)
        self.assertEqual(self.mutate('post','/api/transactions',data|{'amount':'300'}).status_code,409)

    def test_second_device_reads_and_stale_edit_rejected(self):
        data=self.entry();self.mutate('post','/api/transactions',data)
        second=self.app.test_client();token=self.login(second)
        self.assertEqual(self.get('/api/transactions',second).json['total'],1)
        self.assertEqual(self.mutate('put','/api/transactions/'+data['id'],data|{'amount':'99.99','version':1}).status_code,200)
        self.assertEqual(self.mutate('put','/api/transactions/'+data['id'],data|{'version':1},second,token).status_code,409)
        self.assertEqual(self.mutate('delete','/api/transactions/'+data['id'],{'version':1},second,token).status_code,409)
        self.assertEqual(self.mutate('delete','/api/transactions/'+data['id'],{'version':2}).status_code,200)
        self.assertEqual(self.get('/api/transactions',second).json['total'],0)

    def test_unauthorized_csrf_origin_and_cookie_flags(self):
        anon=self.app.test_client()
        for path in ['/api/transactions','/api/summary?month=2026-09','/api/export.csv','/api/session']:
            self.assertEqual(self.get(path,anon).status_code,401)
        self.assertEqual(self.client.post('/api/transactions',base_url=ORIGIN,json=self.entry(),headers={'Origin':ORIGIN}).status_code,403)
        self.assertEqual(self.client.post('/api/transactions',base_url=ORIGIN,json=self.entry(),headers={'Origin':'https://evil.test','X-CSRF-Token':self.csrf}).status_code,403)
        res=anon.post('/api/login',base_url=ORIGIN,json={'username':'syed','password':PASSWORD},headers={'Origin':ORIGIN})
        for value in ['Secure','HttpOnly','SameSite=Strict']:self.assertIn(value,res.headers['Set-Cookie'])

    def test_owner_isolation(self):
        data=self.entry();self.mutate('post','/api/transactions',data)
        other=self.app.test_client();token=self.login(other,'other')
        self.assertEqual(self.get('/api/transactions',other).json['total'],0)
        self.assertEqual(self.get('/api/summary?month=2026-09',other).json['expense'],0)
        self.assertEqual(self.mutate('put','/api/transactions/'+data['id'],data|{'version':1},other,token).status_code,409)

    def test_invalid_money_dates_and_transfer_rejected(self):
        for value in ['-10','0','1.001','NaN','Infinity','1e4','9999999999',1.2,None,[]]:
            self.assertEqual(self.mutate('post','/api/transactions',self.entry(amount=value)).status_code,400,value)
        self.assertEqual(self.mutate('post','/api/transactions',self.entry(day='2026-02-30')).status_code,400)
        self.assertEqual(self.mutate('post','/api/transactions',self.entry(kind='transfer',category='Transfer',to_account='bank')).status_code,400)
        self.assertEqual(self.mutate('post','/api/transactions',self.entry(category='Salary')).status_code,400)

    def test_month_budget_search_export_and_csv_injection(self):
        self.mutate('post','/api/transactions',self.entry(description='=HYPERLINK("example")',account='Household'))
        res=self.mutate('put','/api/budgets',{'month':'2026-09','category':'Overall','amount':'1000.50'})
        self.assertEqual(res.status_code,200)
        self.assertEqual(self.get('/api/summary?month=2026-09').json['budgets']['Overall'],100050)
        self.assertEqual(self.get('/api/summary?month=2026-10').json['budgets'],{})
        self.assertEqual(self.get('/api/transactions?q=household').json['total'],1)
        rows=list(csv.reader(io.StringIO(self.get('/api/export.csv').data.decode('utf-8-sig'))))
        self.assertEqual(rows[1][2],'250.25');self.assertTrue(rows[1][4].startswith("'="))

    def test_password_change_revokes_all_sessions(self):
        second=self.app.test_client();self.login(second)
        response=self.mutate('post','/api/password',{'current_password':PASSWORD,'new_password':'my-different-password-456'})
        self.assertEqual(response.status_code,200)
        self.assertEqual(self.get('/api/session',second).status_code,401)
        self.assertEqual(self.get('/api/session').status_code,401)

    def test_signin_rate_limit_and_logout(self):
        res=self.mutate('post','/api/logout',{});self.assertEqual(res.status_code,200)
        self.assertEqual(self.get('/api/session').status_code,401)
        for _ in range(10):
            res=self.client.post('/api/login',base_url=ORIGIN,json={'username':'syed','password':'bad'},headers={'Origin':ORIGIN})
            self.assertEqual(res.status_code,401)
        res=self.client.post('/api/login',base_url=ORIGIN,json={'username':'syed','password':'bad'},headers={'Origin':ORIGIN})
        self.assertEqual(res.status_code,429)

    def test_persistence_backup_and_static_assets(self):
        self.mutate('post','/api/transactions',self.entry())
        restarted=create_app({'TESTING':True,'DATABASE':self.path,'PUBLIC_ORIGIN':ORIGIN,'COOKIE_SECURE':True})
        second=restarted.test_client();self.login(second)
        self.assertEqual(self.get('/api/transactions',second).json['total'],1)
        backup=Path(self.tmp.name)/'backup.sqlite3'
        subprocess.run([sys.executable,'scripts/backup.py',str(backup)],env=os.environ|{'DATABASE_PATH':self.path},check=True,capture_output=True)
        with sqlite3.connect(backup) as db:
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0],'ok')
            self.assertEqual(db.execute('SELECT count(*) FROM transactions').fetchone()[0],1)
            self.assertEqual(db.execute('SELECT count(*) FROM sessions').fetchone()[0],0)
        restored=Path(self.tmp.name)/'restored.sqlite3'
        result=subprocess.run([sys.executable,'scripts/restore.py',str(backup)],env=os.environ|{'DATABASE_PATH':str(restored),'RESTORE_UID':str(os.getuid()),'RESTORE_GID':str(os.getgid())},capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        with sqlite3.connect(restored) as db:
            self.assertEqual(db.execute('SELECT SUM(amount) FROM transactions').fetchone()[0],25025)
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0],'ok')
        for asset in ['/','/styles.css','/app.js','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png']:
            result=self.get(asset);self.assertEqual(result.status_code,200,asset);result.close()
        self.assertEqual(self.get('/app.py').status_code,404)

if __name__=='__main__':
    unittest.main()
