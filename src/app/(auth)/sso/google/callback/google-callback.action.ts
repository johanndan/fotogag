"use server";

import { createServerAction, ZSAError } from "zsa";
import { googleSSOCallbackSchema } from "@/schemas/google-sso-callback.schema";
import { withRateLimit, RATE_LIMITS } from "@/utils/with-rate-limit";
import {
  GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
} from "@/constants";
import { cookies } from "next/headers";
import { getGoogleSSOClient } from "@/lib/sso/google-sso";
import { decodeIdToken } from "arctic";
import { getDB } from "@/db";
import { eq } from "drizzle-orm";
import { userTable, type User } from "@/db/schema";
import { createAndStoreSession, canSignUp } from "@/utils/auth";
import { isGoogleSSOEnabled } from "@/flags";
import { getIP } from "@/utils/get-IP";
import { consumeReferralOnSignup } from "@/utils/referrals";

type GoogleSSOResponse = {
  iss: string;
  azp: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  at_hash: string;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
  iat: number;
  exp: number;
};

export const googleSSOCallbackAction = createServerAction()
  .input(googleSSOCallbackSchema)
  .handler(async ({ input }) => {
    return withRateLimit(async () => {
      if (!(await isGoogleSSOEnabled())) {
        throw new ZSAError("FORBIDDEN", "Google SSO is not enabled");
      }

      const cookieStore = await cookies();
      const cookieState =
        cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE_NAME)?.value ?? null;
      const cookieCodeVerifier =
        cookieStore.get(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME)?.value ?? null;

      if (!cookieState || !cookieCodeVerifier) {
        throw new ZSAError("NOT_AUTHORIZED", "Missing required cookies");
      }
      if (input.state !== cookieState) {
        throw new ZSAError("NOT_AUTHORIZED", "Invalid state parameter");
      }

      let tokens;
      try {
        const google = getGoogleSSOClient();
        tokens = await google.validateAuthorizationCode(
          input.code,
          cookieCodeVerifier
        );
      } catch (error) {
        console.error(
          "Google OAuth callback: Error validating authorization code",
          error
        );
        throw new ZSAError("NOT_AUTHORIZED", "Invalid authorization code");
      }

      const claims = decodeIdToken(tokens.idToken()) as GoogleSSOResponse;
      const googleAccountId = claims.sub;
      const avatarUrl = claims.picture;
      const email = claims.email;

      await canSignUp({ email });

      const db = getDB();

      try {
        // 1) Bereits mit Google verknüpfter User?
        const existingUserWithGoogle = await db.query.userTable.findFirst({
          where: eq(userTable.googleAccountId, googleAccountId),
        });
        if (existingUserWithGoogle?.id) {
          // Optional: Referral trotzdem versuchen (idempotent)
          await consumeReferralOnSignup({
            email: existingUserWithGoogle.email!,
            userId: existingUserWithGoogle.id,
          });

          await createAndStoreSession(existingUserWithGoogle.id, "google-oauth");
          return { success: true };
        }

        // 2) User mit gleicher E-Mail vorhanden? -> verknüpfen
        const existingUserWithEmail = await db.query.userTable.findFirst({
          where: eq(userTable.email, email),
        });
        if (existingUserWithEmail?.id) {
          const updateResult = await db
            .update(userTable)
            .set({
              googleAccountId,
              avatar: existingUserWithEmail.avatar || avatarUrl,
              emailVerified:
                existingUserWithEmail.emailVerified ||
                (claims?.email_verified ? new Date() : null),
            })
            .where(eq(userTable.id, existingUserWithEmail.id))
            .returning();

          let updatedUser: User | undefined;
          if (Array.isArray(updateResult)) {
            updatedUser = updateResult[0] as unknown as User;
          } else {
            const firstRow = (updateResult as unknown as { [index: number]: unknown })[0];
            updatedUser = firstRow as User;
          }
          if (!updatedUser) {
            throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to update user");
          }

          // Optional & idempotent: Referral jetzt einlösen
          await consumeReferralOnSignup({
            email: updatedUser.email!,
            userId: updatedUser.id,
          });

          await createAndStoreSession(updatedUser.id, "google-oauth");
          return { success: true };
        }

        // 3) Neuer User
        const insertResult = await db
          .insert(userTable)
          .values({
            googleAccountId,
            firstName: claims.given_name || claims.name || null,
            lastName: claims.family_name || null,
            avatar: avatarUrl,
            email,
            emailVerified: claims?.email_verified ? new Date() : null,
            signUpIpAddress: await getIP(),
          })
          .returning();

        let newUser: User | undefined;
        if (Array.isArray(insertResult)) {
          newUser = insertResult[0] as unknown as User;
        } else {
          const firstRow = (insertResult as unknown as { [index: number]: unknown })[0];
          newUser = firstRow as User;
        }
        if (!newUser) {
          throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create user");
        }

        // ✅ Referral einlösen & Credits gutschreiben
        await consumeReferralOnSignup({
          email: newUser.email!,
          userId: newUser.id,
        });

        await createAndStoreSession(newUser.id, "google-oauth");
        return { success: true };
      } catch (error) {
        console.error(error);
        if (error instanceof ZSAError) {
          throw error;
        }
        throw new ZSAError("INTERNAL_SERVER_ERROR", "An unexpected error occurred");
      }
    }, RATE_LIMITS.GOOGLE_SSO_CALLBACK);
  });
