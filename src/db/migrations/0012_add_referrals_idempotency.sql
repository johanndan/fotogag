-- 0012_add_referrals_idempotency.sql

-- Idempotente Gutschrift: externer Schlüssel für Transaktionen
ALTER TABLE credit_transaction
  ADD COLUMN external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_credit_transaction_external_id
  ON credit_transaction (external_id);

-- Falls die Einladungstabelle remote noch fehlt: anlegen mit allen Feldern
CREATE TABLE IF NOT EXISTS referral_invitations (
  id TEXT PRIMARY KEY,
  inviter_user_id TEXT NOT NULL,
  invited_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  credits_awarded INTEGER DEFAULT 0,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_by_user_id TEXT,
  consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS ix_refinv_token ON referral_invitations (token);
CREATE INDEX IF NOT EXISTS ix_refinv_status ON referral_invitations (status);
