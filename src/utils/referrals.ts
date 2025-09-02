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
  appSettingTable,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

const REFERRAL_TOKEN_COOKIE = "referral_token";

// Hilfsfunktion: expiresAt aus DB (string|number|Date|null) -> Date|null
function toDateOrNull(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") {
    const ms = v < 10_000_000_000 ? v * 1000 : v; // sek -> ms
    return new Date(ms);
  }
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) {
      const ms = n < 10_000_000_000 ? n * 1000 : n;
      return new Date(ms);
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export async function consumeReferralOnSignup(params: {
  email: string;
  userId: string;
}): Promise<void> {
  const { email, userId } = params;
  const jar = await cookies();
  const token = jar.get(REFERRAL_TOKEN_COOKIE)?.value;

  const db = getDB();
  const now = new Date();

  // Einladung lookup: bevorzugt per Token+E-Mail, sonst letzte PENDING-Einladung für diese E-Mail
  const invitation = token
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

  // Token-Cookie sofort entfernen – egal ob gefunden oder nicht
  jar.delete(REFERRAL_TOKEN_COOKIE);

  if (!invitation) return;
  if (invitation.status !== REFERRAL_INVITATION_STATUS.PENDING) return;

  // <-- robustes Expiry-Handling (behebt "getTime is not a function")
  const exp = toDateOrNull(invitation.expiresAt as unknown);
  if (exp && exp.getTime() < Date.now()) return;

  const inviterId = invitation.inviterUserId;
  const inviteeId = userId;

  const referralSetting = await db.query.appSettingTable.findFirst({
    where: eq(appSettingTable.key, "referral_bonus_credits"),
    columns: { value: true },
  });
  const inviterBonus = Number(referralSetting?.value ?? 0);

  // Einladung auf ACCEPTED
  await db
    .update(referralInvitationTable)
    .set({
      status: REFERRAL_INVITATION_STATUS.ACCEPTED,
      creditsAwarded: inviterBonus,
      updatedAt: now,
    })
    .where(eq(referralInvitationTable.id, invitation.id));

  // Invitee: referralUserId + E-Mail als verifiziert markieren (Unix-Sekunden)
  const emailVerifiedNow = Math.floor(Date.now() / 1000);
  await db
    .update(userTable)
    .set({
      referralUserId: inviterId,
      emailVerified: emailVerifiedNow,
      updatedAt: now,
    })
    .where(and(eq(userTable.id, inviteeId), sql`${userTable.referralUserId} IS NULL`));

  // Credits für den Einlader (idempotent)
  if (inviterBonus > 0 && inviterId && inviterId !== inviteeId) {
    const inviterTxnId = `ctxn_ref_inv_${invitation.id}`;

    const inviterTxnExists = await db.query.creditTransactionTable.findFirst({
      where: eq(creditTransactionTable.id, inviterTxnId),
    });

    if (!inviterTxnExists) {
      await db.insert(creditTransactionTable).values({
        id: inviterTxnId,
        userId: inviterId,
        amount: inviterBonus,
        remainingAmount: inviterBonus,
        type: CREDIT_TRANSACTION_TYPE.PURCHASE,
        description: `Referral bonus for inviting ${email}`,
        createdAt: now,
        updatedAt: now,
      });

      await db
        .update(userTable)
        .set({
          currentCredits: sql`COALESCE(${userTable.currentCredits}, 0) + ${inviterBonus}`,
          updatedAt: now,
        })
        .where(eq(userTable.id, inviterId));
    }
  }
}
