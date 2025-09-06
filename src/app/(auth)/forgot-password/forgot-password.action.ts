"use server";

import { createServerAction, ZSAError } from "zsa";
import { getDB } from "@/db";
import { userTable } from "@/db/schema";
import { sendPasswordResetEmail } from "@/utils/email";
import { init } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getResetTokenKey } from "@/utils/auth-utils";
import { validateTurnstileToken } from "@/utils/validate-captcha";
import { forgotPasswordSchema } from "@/schemas/forgot-password.schema"; // <- neues (optionales) Schema
import { withRateLimit, RATE_LIMITS } from "@/utils/with-rate-limit";
import { PASSWORD_RESET_TOKEN_EXPIRATION_SECONDS } from "@/constants";
import { isTurnstileEnabled } from "@/flags";

const createId = init({ length: 32 });

export const forgotPasswordAction = createServerAction()
  .input(forgotPasswordSchema) // <- captchaToken jetzt optional
  .handler(async ({ input }) => {
    return withRateLimit(
      async () => {
        // Captcha nur prüfen, wenn Turnstile aktiv ist UND ein Token mitgesendet wurde
        if (await isTurnstileEnabled()) {
          if (input.captchaToken) {
            const success = await validateTurnstileToken(input.captchaToken);
            if (!success) {
              throw new ZSAError("INPUT_PARSE_ERROR", "Please complete the captcha");
            }
          }
          // kein Token => eingeloggt/vertrauenswürdig: weiter ohne Prüfung
        }

        const db = getDB();
        const { env } = getCloudflareContext();

        try {
          // User nach E-Mail suchen (case-insensitive)
          const email = input.email.toLowerCase();
          const user = await db.query.userTable.findFirst({
            where: eq(userTable.email, email),
          });

          // Immer Erfolg zurückgeben (kein User-Enumeration-Leak)
          if (!user) return { success: true };

          // Reset-Token erstellen + in KV ablegen
          const token = createId();
          const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRATION_SECONDS * 1000);

          if (!env?.NEXT_INC_CACHE_KV) {
            throw new Error("Can't connect to KV store");
          }

          await env.NEXT_INC_CACHE_KV.put(
            getResetTokenKey(token),
            JSON.stringify({ userId: user.id, expiresAt: expiresAt.toISOString() }),
            { expirationTtl: Math.floor((expiresAt.getTime() - Date.now()) / 1000) }
          );

          // Reset-Mail senden
          await sendPasswordResetEmail({
            email: user.email!,
            resetToken: token,
            username: user.firstName ?? user.email!,
          });

          return { success: true };
        } catch (error) {
          console.error(error);
          if (error instanceof ZSAError) throw error;

          throw new ZSAError("INTERNAL_SERVER_ERROR", "An unexpected error occurred");
        }
      },
      RATE_LIMITS.FORGOT_PASSWORD
    );
  });
