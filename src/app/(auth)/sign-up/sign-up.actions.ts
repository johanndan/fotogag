// src/app/(auth)/sign-up/sign-up.actions.ts
"use server";

import { createServerAction, ZSAError } from "zsa";
import { getDB } from "@/db";
import {
  userTable,
  type User,
  creditTransactionTable,
  CREDIT_TRANSACTION_TYPE,
  appSettingTable,
} from "@/db/schema";
import { signUpSchema } from "@/schemas/signup.schema";
import { hashPassword } from "@/utils/password-hasher";
import {
  createSession,
  generateSessionToken,
  setSessionTokenCookie,
  canSignUp,
} from "@/utils/auth";
import { eq, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getVerificationTokenKey } from "@/utils/auth-utils";
import { sendVerificationEmail } from "@/utils/email";
import { withRateLimit, RATE_LIMITS } from "@/utils/with-rate-limit";
import { EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS } from "@/constants";
import { getIP } from "@/utils/get-IP";
import { validateTurnstileToken } from "@/utils/validate-captcha";
import { isTurnstileEnabled } from "@/flags";
import { consumeReferralOnSignup } from "@/utils/referrals";

export const signUpAction = createServerAction()
  .input(signUpSchema)
  .handler(async ({ input }) => {
    return withRateLimit(async () => {
      const db = getDB();

      if (await isTurnstileEnabled() && input.captchaToken) {
        const success = await validateTurnstileToken(input.captchaToken);
        if (!success) {
          throw new ZSAError("INPUT_PARSE_ERROR", "Please complete the captcha");
        }
      }

      await canSignUp({ email: input.email });

      const existingUser = await db.query.userTable.findFirst({
        where: eq(userTable.email, input.email),
      });
      if (existingUser) {
        throw new ZSAError("CONFLICT", "Email already taken");
      }

      const hashedPassword = await hashPassword({ password: input.password });

      const insertResult = await db
        .insert(userTable)
        .values({
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          passwordHash: hashedPassword,
          signUpIpAddress: await getIP(),
          lastCreditRefreshAt: new Date(),
        })
        .returning();

      let user: User | undefined;
      if (Array.isArray(insertResult)) {
        user = insertResult[0] as unknown as User;
      } else {
        const firstRow = (insertResult as unknown as { [index: number]: unknown })[0];
        user = firstRow as User;
      }

      if (!user || !user.email) {
        throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create user");
      }

      // Sign-up Bonus
      const signupSetting = await db.query.appSettingTable.findFirst({
        where: eq(appSettingTable.key, "default_registration_credits"),
        columns: { value: true },
      });
      const signupBonus = Number(signupSetting?.value ?? 0);
      const signupTxnId = `ctxn_signup_${user.id}`;
      const existsSignupTxn = await db.query.creditTransactionTable.findFirst({
        where: eq(creditTransactionTable.id, signupTxnId),
      });
      if (!existsSignupTxn && signupBonus > 0) {
        await db.insert(creditTransactionTable).values({
          id: signupTxnId,
          userId: user.id,
          amount: signupBonus,
          remainingAmount: signupBonus,
          type: CREDIT_TRANSACTION_TYPE.PURCHASE,
          description: "Sign-up bonus",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await db
          .update(userTable)
          .set({
            currentCredits: sql`COALESCE(${userTable.currentCredits}, 0) + ${signupBonus}`,
            updatedAt: new Date(),
          })
          .where(eq(userTable.id, user.id));
      }

      // ► Referral-Einladung konsumieren (setzt u.a. emailVerified auf Timestamp)
      try {
        await consumeReferralOnSignup({ email: user.email!, userId: user.id });
      } catch (e) {
        console.error("[referral] consumeReferralOnSignup failed:", e);
      }

      // User frisch laden (hat consumeReferralOnSignup emailVerified gesetzt?)
      const fresh = await db.query.userTable.findFirst({
        where: eq(userTable.id, user.id),
        columns: { emailVerified: true },
      });
      const isAlreadyVerified = !!fresh?.emailVerified && Number(fresh.emailVerified) > 0;

      // Session erstellen
      const sessionToken = generateSessionToken();
      const session = await createSession({
        token: sessionToken,
        userId: user.id,
        authenticationType: "password",
      });
      await setSessionTokenCookie({
        token: sessionToken,
        userId: user.id,
        expiresAt: new Date(session.expiresAt),
      });

      // Verifikations-Mail NUR, wenn nicht schon verifiziert (kein Referral)
      if (!isAlreadyVerified) {
        const { env } = getCloudflareContext();
        const verificationToken = createId();
        const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS * 1000);
        if (!env?.NEXT_INC_CACHE_KV) {
          throw new Error("Can't connect to KV store");
        }
        await env.NEXT_INC_CACHE_KV.put(
          getVerificationTokenKey(verificationToken),
          JSON.stringify({ userId: user.id, expiresAt: expiresAt.toISOString() }),
          { expirationTtl: Math.floor((expiresAt.getTime() - Date.now()) / 1000) },
        );

        await sendVerificationEmail({
          email: user.email!,
          verificationToken,
          username: user.firstName || user.email!,
        });
      }

      return { success: true };
    }, RATE_LIMITS.SIGN_UP);
  });
