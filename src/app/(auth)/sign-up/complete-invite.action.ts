// src/app/(auth)/sign-up/complete-invite.action.ts
"use server";

import { z } from "zod";
import { createServerAction, ZSAError } from "zsa";
import { getDB } from "@/db";
import {
  userTable,
  referralInvitationTable,
  appSettingTable,
  creditTransactionTable,
  CREDIT_TRANSACTION_TYPE,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { scrypt } from "scrypt-js";
import {
  createSession,
  generateSessionToken,
  setSessionTokenCookie,
} from "@/utils/auth";

// ---------- scrypt (Cloudflare-Worker-kompatibel) ----------
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const SCRYPT_N = 16384, SCRYPT_r = 8, SCRYPT_p = 1, DKLEN = 64;
async function hashPasswordScrypt(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const pw = new TextEncoder().encode(password);
  const key = await scrypt(pw, salt, SCRYPT_N, SCRYPT_r, SCRYPT_p, DKLEN);
  return ["scrypt", SCRYPT_N, SCRYPT_r, SCRYPT_p, toHex(salt), toHex(key)].join("$");
}

// ---------- Input ----------
const completeInviteSchema = z.object({
  invitation: z.string().min(10),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().optional().default(""),
  password: z.string().min(8),
});
type DbUser = typeof userTable.$inferSelect;

export const completeInviteAction = createServerAction()
  .input(completeInviteSchema)
  .handler(async ({ input }) => {
    const db = getDB();
    const normalizedEmail = input.email.toLowerCase();

    // 1) Invite prüfen
    const invite = await db.query.referralInvitationTable.findFirst({
      where: and(
        eq(referralInvitationTable.token, input.invitation),
        eq(referralInvitationTable.status, "PENDING"),
      ),
      columns: {
        id: true,
        inviterUserId: true,
        invitedEmail: true,
        status: true,
        expiresAt: true,
        creditsAwarded: true,
      },
    });

    if (!invite || invite.invitedEmail.toLowerCase() !== normalizedEmail) {
      throw new ZSAError("PRECONDITION_FAILED", "Invalid or mismatched invitation");
    }
    if (invite.expiresAt) {
      const exp = invite.expiresAt instanceof Date
        ? invite.expiresAt
        : new Date(invite.expiresAt as unknown as string);
      if (exp < new Date()) {
        throw new ZSAError("PRECONDITION_FAILED", "Invitation expired");
      }
    }

    // 2) Passwort hashen
    const passwordHash = await hashPasswordScrypt(input.password);

    // 3) User anlegen/aktualisieren (E-Mail gilt als verifiziert)
    let user: DbUser | null =
      (await db.query.userTable.findFirst({ where: eq(userTable.email, normalizedEmail) })) ?? null;

    if (!user) {
      await db
        .insert(userTable)
        .values({
          email: normalizedEmail,
          firstName: input.firstName,
          lastName: input.lastName || null,
          passwordHash,
          emailVerified: new Date(),  // Einladung = verifiziert
          lastCreditRefreshAt: new Date(),
        })
        .run();

      user =
        (await db.query.userTable.findFirst({ where: eq(userTable.email, normalizedEmail) })) ?? null;

      if (!user) throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create user");
    } else {
      await db
        .update(userTable)
        .set({
          firstName: input.firstName,
          lastName: input.lastName || null,
          passwordHash,
          emailVerified: user.emailVerified ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, user.id))
        .run();

      user =
        (await db.query.userTable.findFirst({ where: eq(userTable.id, user.id) })) ?? null;
      if (!user) throw new ZSAError("INTERNAL_SERVER_ERROR", "User not found after update");
    }

    // 4) Sign-up-Bonus (Invitee) – idempotent
    const signupSetting = await db.query.appSettingTable.findFirst({
      where: eq(appSettingTable.key, "default_registration_credits"),
      columns: { value: true },
    });
    const signupBonus = Number(signupSetting?.value ?? 0);
    if (signupBonus > 0) {
      const signupTxnId = `ctxn_signup_${user.id}`;
      const exists = await db.query.creditTransactionTable.findFirst({
        where: eq(creditTransactionTable.id, signupTxnId),
        columns: { id: true },
      });
      if (!exists) {
        await db
          .insert(creditTransactionTable)
          .values({
            id: signupTxnId,
            userId: user.id,
            amount: signupBonus,
            remainingAmount: signupBonus,
            type: CREDIT_TRANSACTION_TYPE.PURCHASE,
            description: "Sign-up bonus",
          })
          .run();

        await db
          .update(userTable)
          .set({
            currentCredits: sql`COALESCE(${userTable.currentCredits}, 0) + ${signupBonus}`,
            updatedAt: new Date(),
          })
          .where(eq(userTable.id, user.id))
          .run();
      }
    }

    // 5) Invite auf ACCEPTED + Inviter-Bonus (idempotent & sichtbar im Saldo)
    await db
      .update(referralInvitationTable)
      .set({ status: "ACCEPTED" })
      .where(eq(referralInvitationTable.id, invite.id))
      .run();

    const referralSetting = await db.query.appSettingTable.findFirst({
      where: eq(appSettingTable.key, "referral_bonus_credits"),
      columns: { value: true },
    });
    const inviterBonus = Number(referralSetting?.value ?? 0);

    if (inviterBonus > 0 && invite.inviterUserId) {
      const inviterTxnId = `ctxn_referral_${invite.id}_to_${invite.inviterUserId}`;
      const already = await db.query.creditTransactionTable.findFirst({
        where: eq(creditTransactionTable.id, inviterTxnId),
        columns: { id: true },
      });

      if (!already) {
        await db
          .insert(creditTransactionTable)
          .values({
            id: inviterTxnId,
            userId: invite.inviterUserId,
            amount: inviterBonus,
            remainingAmount: inviterBonus,
            type: CREDIT_TRANSACTION_TYPE.PURCHASE,
            description: `Referral bonus for inviting ${user.email}`,
          })
          .run();

        // Sichtbares Saldo direkt erhöhen (UI nutzt häufig user.currentCredits)
        await db
          .update(userTable)
          .set({
            currentCredits: sql`COALESCE(${userTable.currentCredits}, 0) + ${inviterBonus}`,
            updatedAt: new Date(),
          })
          .where(eq(userTable.id, invite.inviterUserId))
          .run();

        await db
          .update(referralInvitationTable)
          .set({ creditsAwarded: 1 })
          .where(eq(referralInvitationTable.id, invite.id))
          .run();

        // (optional) harte Neuberechnung aus der Historie – nur falls du lieber deterministisch gehst:
        // await recomputeCurrentCreditsFor(db, invite.inviterUserId);
      }
    }

    // referralUserId beim Invitee setzen (nur wenn noch leer)
    if (invite.inviterUserId && !user.referralUserId) {
      await db
        .update(userTable)
        .set({ referralUserId: invite.inviterUserId })
        .where(eq(userTable.id, user.id))
        .run();
    }

    // 6) Session erstellen & einloggen
    const token = generateSessionToken();
    const session = await createSession({
      token,
      userId: user.id,
      authenticationType: "password",
    });
    await setSessionTokenCookie({
      token,
      userId: user.id,
      expiresAt: new Date(session.expiresAt),
    });

    return { ok: true as const };
  });
