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

// Optional via ENV konfigurierbar, sonst Defaults
const INVITER_BONUS = Number(process.env.REFERRAL_INVITER_CREDITS ?? 50);
const INVITEE_BONUS = Number(process.env.REFERRAL_INVITEE_CREDITS ?? 30);

export async function consumeReferralOnSignup(params: {
  email: string;
  userId: string;
}): Promise<void> {
  const { email, userId } = params;
  const jar = await cookies();
  const token = jar.get(REFERRAL_TOKEN_COOKIE)?.value;

  const db = getDB();

  // ⬇️ einzige Änderung: let → const
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

  if (!invitation) {
    return;
  }

  if (invitation.status !== REFERRAL_INVITATION_STATUS.PENDING) {
    jar.delete(REFERRAL_TOKEN_COOKIE);
    return;
  }
  if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
    jar.delete(REFERRAL_TOKEN_COOKIE);
    return;
  }

  await db
    .update(referralInvitationTable)
    .set({
      status: REFERRAL_INVITATION_STATUS.ACCEPTED,
      creditsAwarded: INVITER_BONUS,
      updatedAt: new Date(),
    })
    .where(eq(referralInvitationTable.id, invitation.id));

  await db
    .update(userTable)
    .set({ referralUserId: invitation.inviterUserId, updatedAt: new Date() })
    .where(eq(userTable.id, userId));

  if (INVITER_BONUS > 0) {
    await db
      .update(userTable)
      .set({
        currentCredits: sql`${userTable.currentCredits} + ${INVITER_BONUS}`,
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, invitation.inviterUserId));

    await db.insert(creditTransactionTable).values({
      id: `ctxn_ref_inv_${invitation.id}`,
      userId: invitation.inviterUserId,
      amount: INVITER_BONUS,
      remainingAmount: INVITER_BONUS,
      type: CREDIT_TRANSACTION_TYPE.PURCHASE,
      description: `Referral bonus for inviting ${email}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  if (INVITEE_BONUS > 0) {
    await db
      .update(userTable)
      .set({
        currentCredits: sql`${userTable.currentCredits} + ${INVITEE_BONUS}`,
        updatedAt: new Date(),
      })
      .where(eq(userTable.id, userId));

    await db.insert(creditTransactionTable).values({
      id: `ctxn_ref_new_${userId}`,
      userId,
      amount: INVITEE_BONUS,
      remainingAmount: INVITEE_BONUS,
      type: CREDIT_TRANSACTION_TYPE.PURCHASE,
      description: `Referral welcome bonus`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  jar.delete(REFERRAL_TOKEN_COOKIE);
}
