-- 0013_add_credits_admin_stats.sql
-- Cloudflare D1/SQLite – Migrations: https://developers.cloudflare.com/d1/reference/migrations/
-- SQL-Statements in D1 folgen SQLite: https://developers.cloudflare.com/d1/sql-api/sql-statements/

/* 1) Settings (Key/Value) für Admin-Steuerung
   - default_registration_credits  (Credits bei Registrierung)
   - referral_bonus_credits        (Credits pro erfolgreich angenommener Einladung)
   - credits_per_eur               (Credits pro 1 EUR, REAL für flexible Umrechnungen)
*/
CREATE TABLE IF NOT EXISTS app_setting (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  updatedAt INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
);

-- sinnvolle Defaults; kann der Admin später im UI ändern
INSERT OR IGNORE INTO app_setting (key, value) VALUES
  ('default_registration_credits','20'),
  ('referral_bonus_credits','20'),
  ('credits_per_eur','100');  -- 100 Credits pro 1 EUR (Beispiel)

/* 2) EUR-Betrag an Käufen mitloggen, um Summen in EUR zu zeigen
      (nur bei type='purchase' befüllt)
*/
ALTER TABLE credit_transaction ADD COLUMN fiatAmountCents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE credit_transaction ADD COLUMN fiatCurrency   TEXT    NOT NULL DEFAULT 'EUR';

CREATE INDEX IF NOT EXISTS credit_transaction_fiat_currency_idx ON credit_transaction (fiatCurrency);
-- createdAt/type Indexe existieren bereits in deiner DB

/* 3) Komfort-Views für Auswertungen
   3a) Alle Käufe als eigene Sicht
*/
DROP VIEW IF EXISTS v_credit_purchases;
CREATE VIEW v_credit_purchases AS
SELECT
  id,
  createdAt,
  updatedAt,
  userId,
  amount           AS creditsPurchased,
  fiatAmountCents,
  fiatCurrency
FROM credit_transaction
WHERE type = 'purchase' AND amount > 0;

/* 3b) Vereinheitlichte Sicht auf Referral-Einladungen.
   Im Repo existieren zwei Tabellenvarianten:
   - referral_invitation (0010)
   - referral_invitations (0012)
   Wir vereinigen beide in einer View.
   Hinweis: Beide Tabellen sind in deiner DB vorhanden – daher arbeitet UNION ALL.
*/
DROP VIEW IF EXISTS v_referral_invites;
CREATE VIEW v_referral_invites AS
SELECT
  id,
  inviterUserId               AS inviter_user_id,
  invitedEmail                AS invited_email,
  token,
  status,
  createdAt,
  updatedAt,
  NULL                        AS consumed_by_user_id,
  NULL                        AS consumed_at
FROM referral_invitation

UNION ALL

SELECT
  id,
  inviter_user_id,
  invited_email,
  token,
  status,
  CAST(strftime('%s', created_at) * 1000 AS INTEGER) AS createdAt,
  CAST(strftime('%s', updated_at) * 1000 AS INTEGER) AS updatedAt,
  consumed_by_user_id,
  CAST(strftime('%s', consumed_at) * 1000 AS INTEGER)
FROM referral_invitations;

/* 4) Trigger zur Aktualisierung updatedAt in app_setting */
DROP TRIGGER IF EXISTS trg_app_setting_touch;
CREATE TRIGGER trg_app_setting_touch
AFTER UPDATE ON app_setting
FOR EACH ROW BEGIN
  UPDATE app_setting
  SET updatedAt = (CAST(strftime('%s','now') AS INTEGER) * 1000)
  WHERE key = NEW.key;
END;
