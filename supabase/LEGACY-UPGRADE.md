# Existing profiles upgrade

Use upgrade-legacy-profiles.sql only for the reviewed legacy profiles schema with a UUID primary key referencing auth.users and a text name column. First retain a restorable database backup and validate the complete script in staging. It wraps schema creation, ownership policies, privilege changes and quota setup in one transaction with lock/statement timeouts. Do not run its component migrations separately for this upgrade.

The script preserves the legacy name column and other existing values, adds full_name, creates missing learning tables, fills profile/streak gaps for existing accounts, installs the signup trigger, enables RLS and removes anonymous/PUBLIC access to the learning tables. It does not rename or remove the original columns. The legacy streak column is retained; the new separate streak table starts at zero and is not used for a claimed learning score in the UI.

Test coverage reproduces the legacy schema with synthetic records, validates preservation and owner isolation, verifies new signups and tests reapplication. This is not a backup or verification of live production data.

RLS can change the old site's behavior if it reads profiles without a verified user session. Apply only during a coordinated rollout after confirming auth flows. Do not disable RLS as an app rollback strategy. A failed statement requires ROLLBACK if your SQL client retains the transaction; investigate the error before retrying.

Build and run tests in CI or a development machine, not on a small production VM. The target VM should receive prebuilt frontend assets. No live database changes are performed by this repository's CI.
