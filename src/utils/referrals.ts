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

// .env → integer (whitespace-safe), mit Defaults
function intFromEnv(name: string, fallback: number): number {
  const raw = (process.env[name] ?? "").trim();
  if (raw === "") return fallback;
  const val = Number(raw);
  return Number.isFinite(val) ? val : fallback;
}
const INVITER_BONUS = intFromEnv("REFERRAL_INVITER_CREDITS", 50);
const INVITEE_BONUS = intFromEnv("REFERRAL_INVITEE_CREDITS", 30);

export async function consumeReferralOnSignup(params: {
  email: string;
  userId: string;
}): Promise<void> {
  const { email, userId } = params;
  const jar = await cookies();
  const token = jar.get(REFERRAL_TOKEN_COOKIE)?.value;

  const db = getDB();
  const now = new Date();

  // Einladung laden: Token (Cookie) bevorzugt, sonst letzte offene Einladung zur E-Mail
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

  // Cookie immer weg; ohne Einladung: raus
  jar.delete(REFERRAL_TOKEN_COOKIE);
  if (!invitation) return;

  // Guardrails
  if (invitation.status !== REFERRAL_INVITATION_STATUS.PENDING) return;
  if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) return;

  const inviterId = invitation.inviterUserId;
  const inviteeId = userId;

  await db.transaction(async (tx) => {
    // Einladung als ACCEPTED markieren; nur vorhandene Spalten verwenden
    await tx
      .update(referralInvitationTable)
      .set({
        status: REFERRAL_INVITATION_STATUS.ACCEPTED,
        creditsAwarded: INVITER_BONUS,
        updatedAt: now,
      })
      .where(eq(referralInvitationTable.id, invitation.id));

    // Beim Invitee den inviter referenzieren (nur wenn noch leer)
    await tx
      .update(userTable)
      .set({ referralUserId: inviterId, updatedAt: now })
      .where(and(eq(userTable.id, inviteeId), sql`${userTable.referralUserId} IS NULL`));

    // 1) INVITER Bonus (kein Self-Invite)
    if (INVITER_BONUS > 0 && inviterId && inviterId !== inviteeId) {
      const inviterTxnId = `ctxn_ref_inv_${invitation.id}`;
      const exists = await tx.query.creditTransactionTable.findFirst({
        where: eq(creditTransactionTable.id, inviterTxnId),
      });
      if (!exists) {
        await tx.insert(creditTransactionTable).values({
          id: inviterTxnId,
          userId: inviterId,
          amount: INVITER_BONUS,
          remainingAmount: INVITER_BONUS,
          type: CREDIT_TRANSACTION_TYPE.PURCHASE, // eigener REFERRAL-Typ optional
          description: `Referral bonus for inviting ${email}`,
          // externalId nur setzen, wenn in deinem Schema vorhanden
          // externalId: `referral:${invitation.id}:inviter`,
          createdAt: now,
          updatedAt: now,
        });

        await tx
          .update(userTable)
          .set({
            currentCredits: sql`COALESCE(${userTable.currentCredits}, 0) + ${INVITER_BONUS}`,
            updatedAt: now,
          })
          .where(eq(userTable.id, inviterId));
      }
    }

    // 2) INVITEE Bonus (Welcome)
    if (INVITEE_BONUS > 0) {
      const inviteeTxnId = `ctxn_ref_new_${inviteeId}`;
      const exists = await tx.query.creditTransactionTable.findFirst({
        where: eq(creditTransactionTable.id, inviteeTxnId),
      });
      if (!exists) {
        await tx.insert(creditTransactionTable).values({
          id: inviteeTxnId,
          userId: inviteeId,
          amount: INVITEE_BONUS,
          remainingAmount: INVITEE_BONUS,
          type: CREDIT_TRANSACTION_TYPE.PURCHASE,
          description: `Referral welcome bonus`,
          // externalId: `referral:${invitation.id}:invitee`,
          createdAt: now,
          updatedAt: now,
        });

        await tx
          .update(userTable)
          .set({
            currentCredits: sql`COALESCE(${userTable.currentCredits}, 0) + ${INVITEE_BONUS}`,
            updatedAt: now,
          })
          .where(eq(userTable.id, inviteeId));
      }
    }
  });
}
