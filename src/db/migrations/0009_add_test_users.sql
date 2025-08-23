-- 0009_add_test_users.sql
-- Seed admin & test users for photogag.ai

BEGIN TRANSACTION;

-- Precomputed PBKDF2-HMAC-SHA256 (100k, 32B dkLen) as "saltHex:hashHex"
-- admin password: Allepanzerrollen_=01
WITH admin_values AS (
  SELECT
    'u_admin_seed' AS id,
    'johanndanci7@gmail.com' AS email,
    '461bf3028cdd6bc22b024ecdebea312d:c62c230f71b4c31405860fd092e89a778e7fa1d6c9b660eafa46b21377d6ea5b' AS pwhex
),
-- test password: Allepanzerrollen_=02
test_values AS (
  SELECT
    'u_test_seed' AS id,
    'katta123@web.de' AS email,
    '9696f4f18ba62547cc1c5cc77d49fa40:a81450dd8f74e4ef54dc871887173b18972e9449612b10a78c76c17ef706a61b' AS pwhex
),

-- Helper CTEs to detect schema
has_password_col AS (
  SELECT EXISTS(SELECT 1 FROM pragma_table_info('user') WHERE name='password') AS ok
),
has_hashed_password_col AS (
  SELECT EXISTS(SELECT 1 FROM pragma_table_info('user') WHERE name='hashed_password') AS ok
),
has_role_col AS (
  SELECT EXISTS(SELECT 1 FROM pragma_table_info('user') WHERE name='role') AS ok
),
has_is_admin_col AS (
  SELECT EXISTS(SELECT 1 FROM pragma_table_info('user') WHERE name='is_admin') AS ok
),
has_email_verified_col AS (
  SELECT EXISTS(SELECT 1 FROM pragma_table_info('user') WHERE name='email_verified') AS ok
),
has_created_at_col AS (
  SELECT EXISTS(SELECT 1 FROM pragma_table_info('user') WHERE name='created_at') AS ok
),
has_key_table AS (
  SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='key') AS ok
)

-- Insert path A: password stored in user.password
INSERT INTO "user" (id, email, password, created_at)
SELECT a.id, a.email, a.pwhex,
       CASE WHEN (SELECT ok FROM has_created_at_col)=1 THEN CURRENT_TIMESTAMP END
FROM admin_values a
WHERE (SELECT ok FROM has_password_col)=1
  AND NOT EXISTS (SELECT 1 FROM "user" WHERE email=a.email);

INSERT INTO "user" (id, email, password, created_at)
SELECT t.id, t.email, t.pwhex,
       CASE WHEN (SELECT ok FROM has_created_at_col)=1 THEN CURRENT_TIMESTAMP END
FROM test_values t
WHERE (SELECT ok FROM has_password_col)=1
  AND NOT EXISTS (SELECT 1 FROM "user" WHERE email=t.email);

-- Insert path B: password stored in user.hashed_password
INSERT INTO "user" (id, email, hashed_password, created_at)
SELECT a.id, a.email, a.pwhex,
       CASE WHEN (SELECT ok FROM has_created_at_col)=1 THEN CURRENT_TIMESTAMP END
FROM admin_values a
WHERE (SELECT ok FROM has_hashed_password_col)=1
  AND NOT EXISTS (SELECT 1 FROM "user" WHERE email=a.email);

INSERT INTO "user" (id, email, hashed_password, created_at)
SELECT t.id, t.email, t.pwhex,
       CASE WHEN (SELECT ok FROM has_created_at_col)=1 THEN CURRENT_TIMESTAMP END
FROM test_values t
WHERE (SELECT ok FROM has_hashed_password_col)=1
  AND NOT EXISTS (SELECT 1 FROM "user" WHERE email=t.email);

-- Insert path C: Lucia-style (user row + key row with hashed_password)
-- Create users (minimal columns) if key-table exists and user doesn't exist
INSERT INTO "user" (id, email, created_at)
SELECT a.id, a.email,
       CASE WHEN (SELECT ok FROM has_created_at_col)=1 THEN CURRENT_TIMESTAMP END
FROM admin_values a
WHERE (SELECT ok FROM has_key_table)=1
  AND NOT EXISTS (SELECT 1 FROM "user" WHERE email=a.email);

INSERT INTO "user" (id, email, created_at)
SELECT t.id, t.email,
       CASE WHEN (SELECT ok FROM has_created_at_col)=1 THEN CURRENT_TIMESTAMP END
FROM test_values t
WHERE (SELECT ok FROM has_key_table)=1
  AND NOT EXISTS (SELECT 1 FROM "user" WHERE email=t.email);

-- Key rows for passwords (if key table exists)
-- Convention: key.id = 'email:' || email
INSERT INTO "key" (id, user_id, hashed_password)
SELECT 'email:' || a.email, a.id, a.pwhex
FROM admin_values a
WHERE (SELECT ok FROM has_key_table)=1
  AND NOT EXISTS (SELECT 1 FROM "key" WHERE id = 'email:' || a.email);

INSERT INTO "key" (id, user_id, hashed_password)
SELECT 'email:' || t.email, t.id, t.pwhex
FROM test_values t
WHERE (SELECT ok FROM has_key_table)=1
  AND NOT EXISTS (SELECT 1 FROM "key" WHERE id = 'email:' || t.email);

-- Optional flags/roles if such columns exist
UPDATE "user"
   SET role = 'ADMIN'
 WHERE email = (SELECT email FROM admin_values)
   AND (SELECT ok FROM has_role_col)=1;

UPDATE "user"
   SET is_admin = 1
 WHERE email = (SELECT email FROM admin_values)
   AND (SELECT ok FROM has_is_admin_col)=1;

UPDATE "user"
   SET email_verified = 1
 WHERE email IN ((SELECT email FROM admin_values),(SELECT email FROM test_values))
   AND (SELECT ok FROM has_email_verified_col)=1;

COMMIT;
