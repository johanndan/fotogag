-- 0009_add_test_users.sql
-- Seed admin & test users for photogag.ai (D1-safe; no BEGIN/COMMIT)

-- Admin  Allepanzerrollen_=01
INSERT INTO "user" (id, email, passwordHash, role, emailVerified, createdAt, updatedAt)
SELECT
  'u_admin_seed',
  'johanndanci7@gmail.com',
  '461bf3028cdd6bc22b024ecdebea312d:c62c230f71b4c31405860fd092e89a778e7fa1d6c9b660eafa46b21377d6ea5b',
  'admin',
  1,
  CAST(strftime('%s','now') AS INTEGER) * 1000,
  CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE email = 'johanndanci7@gmail.com');

-- Test-User  Allepanzerrollen_=02
INSERT INTO "user" (id, email, passwordHash, role, emailVerified, createdAt, updatedAt)
SELECT
  'u_test_seed',
  'katta123@web.de',
  '9696f4f18ba62547cc1c5cc77d49fa40:a81450dd8f74e4ef54dc871887173b18972e9449612b10a78c76c17ef706a61b',
  'user',
  1,
  CAST(strftime('%s','now') AS INTEGER) * 1000,
  CAST(strftime('%s','now') AS INTEGER) * 1000
WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE email = 'katta123@web.de');
