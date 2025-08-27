"use server";

import { createServerAction, ZSAError } from "zsa";
import { getDB } from "@/db";
import { userTable, type User } from "@/db/schema";
import { signUpSchema } from "@/schemas/signup.schema";
import { hashPassword } from "@/utils/password-hasher";
import { createSession, generateSessionToken, setSessionTokenCookie, canSignUp } from "@/utils/auth";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getVerificationTokenKey } from "@/utils/auth-utils";
import { sendVerificationEmail } from "@/utils/email";
import { withRateLimit, RATE_LIMITS } from "@/utils/with-rate-limit";
import { EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS } from "@/constants";
import { getIP } from "@/utils/get-IP";
import { validateTurnstileToken } from "@/utils/validate-captcha";
import { isTurnstileEnabled } from "@/flags";

/*
 * User signup action.
 *
 * This action handles user registration with email/password. It performs
 * validation, creates the user in the database, sets up a session, stores
 * a verification token in KV, and sends a verification email. The insert
 * result is normalized to a User type without using the `any` keyword.
 */
export const signUpAction = createServerAction()
  .input(signUpSchema)
  .handler(async ({ input }) => {
    return withRateLimit(async () => {
      const db = getDB();
      const { env } = getCloudflareContext();

      // Validate turnstile captcha if required
      if (await isTurnstileEnabled() && input.captchaToken) {
        const success = await validateTurnstileToken(input.captchaToken);
        if (!success) {
          throw new ZSAError("INPUT_PARSE_ERROR", "Please complete the captcha");
        }
      }

      // Check if sign up is allowed for this email
      await canSignUp({ email: input.email });

      // Ensure the email isn't already taken
      const existingUser = await db.query.userTable.findFirst({
        where: eq(userTable.email, input.email),
      });
      if (existingUser) {
        throw new ZSAError("CONFLICT", "Email already taken");
      }

      // Hash the password securely
      const hashedPassword = await hashPassword({ password: input.password });

      // Insert the new user and normalize the result to a User type
      const insertResult = await db
        .insert(userTable)
        .values({
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          passwordHash: hashedPassword,
          signUpIpAddress: await getIP(),
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

      try {
        // Create a session for the new user
        const sessionToken = generateSessionToken();
        const session = await createSession({
          token: sessionToken,
          userId: user.id,
          authenticationType: "password",
        });

        // Set the session cookie
        await setSessionTokenCookie({
          token: sessionToken,
          userId: user.id,
          expiresAt: new Date(session.expiresAt),
        });

        // Create and store a verification token in KV
        const verificationToken = createId();
        const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS * 1000);
        if (!env?.NEXT_INC_CACHE_KV) {
          throw new Error("Can't connect to KV store");
        }
        await env.NEXT_INC_CACHE_KV.put(
          getVerificationTokenKey(verificationToken),
          JSON.stringify({
            userId: user.id,
            expiresAt: expiresAt.toISOString(),
          }),
          {
            expirationTtl: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
          }
        );

        // Send the verification email
        await sendVerificationEmail({
          email: user.email,
          verificationToken,
          username: user.firstName || user.email,
        });
      } catch (error) {
        console.error(error);
        throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create session after signup");
      }

      return { success: true };
    }, RATE_LIMITS.SIGN_UP);
  });