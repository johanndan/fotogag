"use server";

import { createServerAction, ZSAError } from "zsa";
import { getSessionFromCookie, requireVerifiedEmail } from "@/utils/auth";
import {
  getAllSessionIdsOfUser,
  getKVSession,
  deleteKVSession,
} from "@/utils/kv-session";
import { z } from "zod";
import { withRateLimit, RATE_LIMITS } from "@/utils/with-rate-limit";
import { UAParser } from "ua-parser-js";
import { SessionWithMeta } from "@/types";

function isValidSession(session: unknown): session is SessionWithMeta {
  if (!session || typeof session !== "object") return false;
  const sessionObj = session as Record<string, unknown>;
  return "createdAt" in sessionObj && typeof sessionObj.createdAt === "number";
}

export const getSessionsAction = createServerAction()
  .input(z.void())
  .handler(async () => {
    return withRateLimit(async () => {
      const session = await requireVerifiedEmail();

      if (!session?.user?.id) {
        throw new ZSAError("NOT_AUTHORIZED", "Unauthorized");
      }

      const sessionIds = await getAllSessionIdsOfUser(session.user.id);
      const sessions = await Promise.all(
        sessionIds.map(async ({ key, absoluteExpiration }) => {
          const sessionId = key.split(":")[2]; // Format: "session:userId:sessionId"
          const sessionData = await getKVSession(sessionId, session.user.id);

          if (!sessionData) return null;

          const result = new UAParser(sessionData.userAgent ?? "").getResult();

          return {
            ...sessionData,
            isCurrentSession: sessionId === session.id,
            expiration: absoluteExpiration,
            createdAt: sessionData.createdAt ?? 0,
            parsedUserAgent: {
              ua: result.ua,
              browser: {
                name: result.browser.name,
                version: result.browser.version,
                major: result.browser.major,
              },
              device: {
                model: result.device.model,
                type: result.device.type,
                vendor: result.device.vendor,
              },
              engine: {
                name: result.engine.name,
                version: result.engine.version,
              },
              os: {
                name: result.os.name,
                version: result.os.version,
              },
            },
          } as SessionWithMeta;
        })
      );

      return sessions.filter(isValidSession).sort((a, b) => b.createdAt - a.createdAt);
    }, RATE_LIMITS.SETTINGS);
  });

export const deleteSessionAction = createServerAction()
  .input(
    z.object({
      sessionId: z.string(),
    })
  )
  .handler(async ({ input }) => {
    return withRateLimit(async () => {
      const session = await getSessionFromCookie();

      if (!session) {
        throw new ZSAError("NOT_AUTHORIZED", "Not authenticated");
      }

      await deleteKVSession(input.sessionId, session.user.id);

      return { success: true };
    }, RATE_LIMITS.DELETE_SESSION);
  });

/** Neu: alle Sessions eines Users löschen (optional die aktuelle behalten) */
export const deleteAllSessionsOfUserAction = createServerAction()
  .input(
    z.object({
      /** Optional: aktuelle Session während des Delete-Flows noch behalten */
      keepCurrentSessionId: z.string().optional(),
    })
  )
  .handler(async ({ input }) => {
    return withRateLimit(async () => {
      const session = await getSessionFromCookie();
      if (!session?.user?.id) {
        throw new ZSAError("NOT_AUTHORIZED", "Not authenticated");
      }

      const userId = session.user.id;
      const all = await getAllSessionIdsOfUser(userId);

      let deleted = 0;
      await Promise.all(
        all.map(async ({ key }) => {
          const sessionId = key.split(":")[2]; // "session:{userId}:{sessionId}"
          if (input.keepCurrentSessionId && sessionId === input.keepCurrentSessionId) return;
          await deleteKVSession(sessionId, userId);
          deleted++;
        })
      );

      return { success: true, deleted };
    }, RATE_LIMITS.DELETE_SESSION);
  });
