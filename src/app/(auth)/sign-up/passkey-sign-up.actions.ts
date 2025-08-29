// src/app/(auth)/sign-up/passkey-sign-up.actions.ts
"use server";

import { createServerAction, ZSAError } from "zsa";
import { z } from "zod";
import {
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistration,
} from "@/utils/webauthn";
import { getDB } from "@/db";
import {
  userTable,
  type User,
  creditTransactionTable,
  CREDIT_TRANSACTION_TYPE,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { cookies, headers } from "next/headers";
import {
  createSession,
  generateSessionToken,
  setSessionTokenCookie,
  canSignUp,
} from "@/utils/auth";
import type {
  RegistrationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/types";
import { withRateLimit, RATE_LIMITS } from "@/utils/with-rate-limit";
import { getIP } from "@/utils/get-IP";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getVerificationTokenKey } from "@/utils/auth-utils";
import { sendVerificationEmail } from "@/utils/email";
import { EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS } from "@/constants";
import { passkeyEmailSchema } from "@/schemas/passkey.schema";
import ms from "ms";
import { validateTurnstileToken } from "@/utils/validate-captcha";
import { isTurnstileEnabled } from "@/flags";
import { consumeReferralOnSignup } from "@/utils/referrals";

// Cookies für den Passkey-Flow
const PASSKEY_CHALLENGE_COOKIE_NAME = "passkey_challenge";
const PASSKEY_USER_ID_COOKIE_NAME = "passkey_user_id";

/**
 * Startet die Passkey-Registrierung:
 *  - Validiert Captcha
 *  - Legt den Benutzer an (inkl. lastCreditRefreshAt)
 *  - Sign-up-Bonus 30 (idempotent, COALESCE)
 *  - Referral (nur Einlader-Bonus) idempotent
 *  - Liefert WebAuthn-Options zurück
 */
export const startPasskeyRegistrationAction = createServerAction()
  .input(passkeyEmailSchema)
  .handler(async ({ input }) => {
    return withRateLimit(
      async () => {
        if (await isTurnstileEnabled() && input.captchaToken) {
          const success = await validateTurnstileToken(input.captchaToken);
          if (!success) {
            throw new ZSAError("INPUT_PARSE_ERROR", "Please complete the captcha");
          }
        }

        const db = getDB();
        await canSignUp({ email: input.email });

        const existingUser = await db.query.userTable.findFirst({
          where: eq(userTable.email, input.email),
        });
        if (existingUser) {
          throw new ZSAError("CONFLICT", "An account with this email already exists");
        }

        const ipAddress = await getIP();

        const insertResult = await db
          .insert(userTable)
          .values({
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            signUpIpAddress: ipAddress,
            lastCreditRefreshAt: new Date(), // Initialwert
          })
          .returning();

        // D1 kann Array oder D1Result zurückgeben
        let user: User | undefined;
        if (Array.isArray(insertResult)) {
          user = insertResult[0] as unknown as User;
        } else {
          const firstRow = (insertResult as unknown as { [index: number]: unknown })[0];
          user = firstRow as User;
        }

        if (!user) {
          throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create user");
        }

        // Sign-up-Bonus (30) genau einmal – idempotent (COALESCE gegen NULL)
        const signupTxnId = `ctxn_signup_${user.id}`;
        const exists = await db.query.creditTransactionTable.findFirst({
          where: eq(creditTransactionTable.id, signupTxnId),
        });
        if (!exists) {
          await db.insert(creditTransactionTable).values({
            id: signupTxnId,
            userId: user.id,
            amount: 30,
            remainingAmount: 30,
            type: CREDIT_TRANSACTION_TYPE.PURCHASE,
            description: "Sign-up bonus",
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          await db
            .update(userTable)
            .set({
              currentCredits: sql`COALESCE(${userTable.currentCredits}, 0) + 30`,
              updatedAt: new Date(),
            })
            .where(eq(userTable.id, user.id));
        }

        // Referral (nur Einlader bekommt 50, Invitee KEINE Extra-Credits)
        try {
          await consumeReferralOnSignup({ email: user.email!, userId: user.id });
        } catch (e) {
          console.error("[referral] consumeReferralOnSignup failed:", e);
        }

        // WebAuthn-Options für den Client
        const options = await generatePasskeyRegistrationOptions(user.id, input.email);

        const cookieStore = await cookies();
        cookieStore.set(PASSKEY_CHALLENGE_COOKIE_NAME, options.challenge, {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          path: "/",
          maxAge: Math.floor(ms("10 minutes") / 1000),
        });
        cookieStore.set(PASSKEY_USER_ID_COOKIE_NAME, user.id, {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          path: "/",
          maxAge: Math.floor(ms("10 minutes") / 1000),
        });

        const optionsJSON: PublicKeyCredentialCreationOptionsJSON = {
          rp: options.rp,
          user: options.user,
          challenge: options.challenge,
          pubKeyCredParams: options.pubKeyCredParams,
          timeout: options.timeout,
          excludeCredentials: options.excludeCredentials,
          authenticatorSelection: options.authenticatorSelection,
          attestation: options.attestation,
          extensions: options.extensions,
        };

        return { optionsJSON };
      },
      RATE_LIMITS.SIGN_UP
    );
  });

/**
 * Schließt die Passkey-Registrierung ab:
 *  - Verifiziert Antwort
 *  - Versendet Verifikations-E-Mail
 *  - Erstellt Session & Cookie
 */
const completePasskeyRegistrationSchema = z.object({
  response: z.custom<RegistrationResponseJSON>(
    (val): val is RegistrationResponseJSON =>
      typeof val === "object" && val !== null && "id" in val && "rawId" in val,
    "Invalid registration response"
  ),
});

export const completePasskeyRegistrationAction = createServerAction()
  .input(completePasskeyRegistrationSchema)
  .handler(async ({ input }) => {
    const cookieStore = await cookies();
    const challenge = cookieStore.get(PASSKEY_CHALLENGE_COOKIE_NAME)?.value;
    const userId = cookieStore.get(PASSKEY_USER_ID_COOKIE_NAME)?.value;

    if (!challenge || !userId) {
      throw new ZSAError("PRECONDITION_FAILED", "Invalid registration session");
    }

    try {
      await verifyPasskeyRegistration({
        userId,
        response: input.response,
        challenge,
        userAgent: (await headers()).get("user-agent"),
        ipAddress: await getIP(),
      });

      const db = getDB();
      const user = await db.query.userTable.findFirst({
        where: eq(userTable.id, userId),
      });
      if (!user || !user.email) {
        throw new ZSAError("INTERNAL_SERVER_ERROR", "User not found");
      }

      // Verifikations-Token in KV ablegen
      const { env } = getCloudflareContext();
      const verificationToken = createId();
      const expiresAt = new Date(
        Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS * 1000
      );
      if (!env?.NEXT_INC_CACHE_KV) {
        throw new Error("Can't connect to KV store");
      }
      await env.NEXT_INC_CACHE_KV.put(
        getVerificationTokenKey(verificationToken),
        JSON.stringify({ userId: user.id, expiresAt: expiresAt.toISOString() }),
        { expirationTtl: Math.floor((expiresAt.getTime() - Date.now()) / 1000) }
      );

      await sendVerificationEmail({
        email: user.email,
        verificationToken,
        username: user.firstName || user.email,
      });

      // Session erstellen & Cookie setzen
      const sessionToken = generateSessionToken();
      const session = await createSession({
        token: sessionToken,
        userId,
        authenticationType: "passkey",
        passkeyCredentialId: input.response.id,
      });
      await setSessionTokenCookie({
        token: sessionToken,
        userId,
        expiresAt: new Date(session.expiresAt),
      });

      // temporäre Cookies entfernen
      cookieStore.delete(PASSKEY_CHALLENGE_COOKIE_NAME);
      cookieStore.delete(PASSKEY_USER_ID_COOKIE_NAME);

      return { success: true };
    } catch (error) {
      console.error("Failed to register passkey:", error);
      throw new ZSAError("PRECONDITION_FAILED", "Failed to register passkey");
    }
  });
