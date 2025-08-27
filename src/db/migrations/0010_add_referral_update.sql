-- SQL migration to remove team-related tables and add referral features

-- Add new column to store who invited a user (nullable)
ALTER TABLE "user" ADD COLUMN "referralUserId" TEXT REFERENCES "user"("id");

-- Create an index on referralUserId for faster lookups
CREATE INDEX IF NOT EXISTS "referral_user_id_idx" ON "user"("referralUserId");

-- Drop team-related tables if they exist
DROP TABLE IF EXISTS "team_invitation";
DROP TABLE IF EXISTS "team_role";
DROP TABLE IF EXISTS "team_membership";
DROP TABLE IF EXISTS "team";

-- Create referral_invitation table to manage referral invites
CREATE TABLE IF NOT EXISTS "referral_invitation" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "inviterUserId" TEXT NOT NULL REFERENCES "user"("id"),
  "invitedEmail" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" INTEGER,
  "creditsAwarded" INTEGER NOT NULL DEFAULT 0,
  "createdAt" INTEGER NOT NULL,
  "updatedAt" INTEGER NOT NULL,
  "updateCounter" INTEGER NOT NULL DEFAULT 0
);

-- Indexes for referral_invitation table
CREATE INDEX IF NOT EXISTS "referral_invitation_inviter_idx" ON "referral_invitation"("inviterUserId");
CREATE INDEX IF NOT EXISTS "referral_invitation_email_idx" ON "referral_invitation"("invitedEmail");
CREATE INDEX IF NOT EXISTS "referral_invitation_token_idx" ON "referral_invitation"("token");