PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf TEXT NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_limits (
 bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS transactions (
 id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
 day TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('expense','income','transfer')),
 amount INTEGER NOT NULL CHECK(amount > 0), category TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '', account TEXT NOT NULL, to_account TEXT NOT NULL DEFAULT '',
 method TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_day ON transactions(user_id, day DESC);
CREATE TABLE IF NOT EXISTS budgets (
 user_id INTEGER NOT NULL REFERENCES users(id), month TEXT NOT NULL,
 category TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount >= 0),
 PRIMARY KEY(user_id, month, category)
);
PRAGMA user_version = 1;
