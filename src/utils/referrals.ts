// src/utils/referrals.ts
import "server-only";
import { cookies } from "next/headers";
import { getDB } from "@/db";
import {
  referralInvitationTable,
  userTable,
  creditTransactionTable,
  CREDIT_TRANSACTION_TYPE,
  REFERRAL_INVITATION_STATUS,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

const REFERRAL_TOKEN_COOKIE = "referral_token";

// .env → Integer (whitespace-sicher)
function intFromEnv(name: string, fallback: number): number {
  const raw = (process.env[name] ?? "").trim();
  if (raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
const INVITER_BONUS = intFromEnv("REFERRAL_INVITER_CREDITS", 50);
// WICHTIG: Eingeladene bekommen KEINEN zusätzlichen Referral-Bonus
// (die 30 Credits kommen aus dem normalen Sign-up-Bonus)
const INVITEE_BONUS_EFFECTIVE = 0;

export async function consumeReferralOnSignup(params: {
  email: string;
  userId: string;
}): Promise<void> {
  const { email, userId } = params;
  const jar = await cookies();
  const token = jar.get(REFERRAL_TOKEN_COOKIE)?.value;

  const db = getDB();
  const now = new Date();

  // Einladung suchen: Cookie-Token bevorzugt, sonst letzte offene Einladung für die E-Mail
  const invitation =
    token
      ? await db.query.referralInvitationTable.findFirst({
          where: and(
            eq(referralInvitationTable.token, token),
            eq(referralInvitationTable.invitedEmail, email),
          ),
        })
      : await db.query.referralInvitationTable.findFirst({
          where: and(
            eq(referralInvitationTable.invitedEmail, email),
            eq(referralInvitationTable.status, REFERRAL_INVITATION_STATUS.PENDING),
          ),
          orderBy: (t, { desc }) => [desc(t.createdAt)],
        });

  // Cookie immer aufräumen
  jar.delete(REFERRAL_TOKEN_COOKIE);

  if (!invitation) return;
  if (invitation.status !== REFERRAL_INVITATION_STATUS.PENDING) return;
  if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) return;

  const inviterId = invitation.inviterUserId;
  const inviteeId = userId;

  // 1) Einladung als ACCEPTED markieren
  await db
    .update(referralInvitationTable)
    .set({
      status: REFERRAL_INVITATION_STATUS.ACCEPTED,
      creditsAwarded: INVITER_BONUS,
      updatedAt: now,
    })
    .where(eq(referralInvitationTable.id, invitation.id));

  // 2) Beim Invitee den Referrer nur setzen, wenn noch leer
  await db
    .update(userTable)
    .set({ referralUserId: inviterId, updatedAt: now })
    .where(and(eq(userTable.id, inviteeId), sql`${userTable.referralUserId} IS NULL`));

  // 3) INVITER-Bonus (kein Self-Invite) — idempotent ohne Transaktion
  if (INVITER_BONUS > 0 && inviterId && inviterId !== inviteeId) {
    const inviterTxnId = `ctxn_ref_inv_${invitation.id}`;

    const inviterTxnExists = await db.query.creditTransactionTable.findFirst({
      where: eq(creditTransactionTable.id, inviterTxnId),
    });

    if (!inviterTxnExists) {
      await db.insert(creditTransactionTable).values({
        id: inviterTxnId,
        userId: inviterId,
        amount: INVITER_BONUS,
        remainingAmount: INVITER_BONUS,
        type: CREDIT_TRANSACTION_TYPE.PURCHASE, // eigener REFERRAL-Typ optional
        description: `Referral bonus for inviting ${email}`,
        createdAt: now,
        updatedAt: now,
      });

      await db
        .update(userTable)
        .set({
          currentCredits: sql`COALESCE(${userTable.currentCredits}, 0) + ${INVITER_BONUS}`,
          updatedAt: now,
        })
        .where(eq(userTable.id, inviterId));
    }
  }

  // 4) KEIN zusätzlicher Invitee-Bonus (Absicht!)
  if (INVITEE_BONUS_EFFECTIVE > 0) {
    // bewusst leer – Geschäftslogik: Eingeladene erhalten NUR den allgemeinen Sign-up-Bonus
  }
}
