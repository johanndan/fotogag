// /src/utils/kv-session.ts
import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";

import { getUserFromDB } from "@/utils/auth";
import { getIP } from "./get-IP";
import { MAX_SESSIONS_PER_USER } from "@/constants";

const SESSION_PREFIX = "session:";

/** Sliding-Window-Konstanten (30 Tage Inaktivität; Refresh, wenn < 7 Tage übrig) */
export const MAX_INACTIVITY_MS = 30 * 24 * 60 * 60 * 1000; // 30d
export const MIN_TTL_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;  // 7d

export function getSessionKey(userId: string, sessionId: string): string {
  return `${SESSION_PREFIX}${userId}:${sessionId}`;
}

type KVSessionUser = Exclude<Awaited<ReturnType<typeof getUserFromDB>>, undefined>;

/**
 * KVSession represents the data stored in our KV backend for each user session.
 * The team functionality has been removed, so this interface no longer
 * contains a teams array.  If this interface changes, CURRENT_SESSION_VERSION
 * must be incremented to force existing sessions to be re-written.
 */
export interface KVSession {
  id: string;
  userId: string;
  /** absolute Ablauffrist in ms since epoch (spiegelt die gesetzte TTL zu Schreibzeit wider) */
  expiresAt: number;
  createdAt: number;
  user: KVSessionUser & {
    initials?: string;
  };
  country?: string;
  city?: string;
  continent?: string;
  ip?: string | null;
  userAgent?: string | null;
  authenticationType?: "passkey" | "password" | "google-oauth";
  passkeyCredentialId?: string;
  /**
   * IMPORTANT: increment CURRENT_SESSION_VERSION when modifying this shape.
   */
  version?: number;
}

/**
 * IMPORTANT: If the KVSession interface above changes, bump this version.  Any
 * mismatch between stored session version and this value triggers a session
 * refresh.
 */
export const CURRENT_SESSION_VERSION = 3;

export async function getKV() {
  const { env } = getCloudflareContext();
  return env.NEXT_INC_CACHE_KV;
}

/* --------------------------------- Helpers -------------------------------- */

function ttlSecondsFromDate(expiresAt: Date): number {
  const ms = expiresAt.getTime() - Date.now();
  // Cloudflare KV erfordert eine Mindest-TTL; 60s ist safe default.
  return Math.max(60, Math.floor(ms / 1000));
}

/** Liefert die verbleibende Laufzeit einer Session in Millisekunden (kann < 0 sein) */
export function getRemainingTtlMs(session: Pick<KVSession, "expiresAt">): number {
  return session.expiresAt - Date.now();
}

/** Sollten wir die TTL „anfassen“? Default: wenn < 7 Tage übrig sind. */
export function shouldRefreshSessionTTL(
  session: Pick<KVSession, "expiresAt">,
  thresholdMs: number = MIN_TTL_REFRESH_MS
): boolean {
  return getRemainingTtlMs(session) < thresholdMs;
}

export interface CreateKVSessionParams extends Omit<KVSession, "id" | "createdAt" | "expiresAt"> {
  sessionId: string;
  /** initiale Ablaufzeit (z. B. jetzt + 30d) */
  expiresAt: Date;
}

/* --------------------------------- Create --------------------------------- */

export async function createKVSession({
  sessionId,
  userId,
  expiresAt,
  user,
  authenticationType,
  passkeyCredentialId,
}: CreateKVSessionParams): Promise<KVSession> {
  const { cf } = getCloudflareContext();
  const headersList = await headers();
  const kv = await getKV();
  if (!kv) {
    throw new Error("Can't connect to KV store");
  }

  const session: KVSession = {
    id: sessionId,
    userId,
    expiresAt: expiresAt.getTime(),
    createdAt: Date.now(),
    country: cf?.country,
    city: cf?.city,
    continent: cf?.continent,
    ip: await getIP(),
    userAgent: headersList.get("user-agent"),
    user,
    authenticationType,
    passkeyCredentialId,
    version: CURRENT_SESSION_VERSION,
  };

  // Session limit enforcement
  const existingSessions = await getAllSessionIdsOfUser(userId);
  if (existingSessions.length >= MAX_SESSIONS_PER_USER) {
    // Sort sessions by expiration time (oldest first)
    const sortedSessions = [...existingSessions].sort((a, b) => {
      if (!a.absoluteExpiration) return -1;
      if (!b.absoluteExpiration) return 1;
      return a.absoluteExpiration.getTime() - b.absoluteExpiration.getTime();
    });
    const oldestSessionKey = sortedSessions?.[0]?.key;
    const oldestSessionId = oldestSessionKey?.split(":")?.[2];
    await deleteKVSession(oldestSessionId, userId);
  }

  // set TTL anhand expiresAt (sliding TTL wird über touch/update verlängert)
  await kv.put(getSessionKey(userId, sessionId), JSON.stringify(session), {
    expirationTtl: ttlSecondsFromDate(expiresAt),
  });

  return session;
}

/* ---------------------------------- Read ---------------------------------- */

export async function getKVSession(sessionId: string, userId: string): Promise<KVSession | null> {
  const kv = await getKV();
  if (!kv) {
    throw new Error("Can't connect to KV store");
  }
  const sessionStr = await kv.get(getSessionKey(userId, sessionId));
  if (!sessionStr) return null;

  const session = JSON.parse(sessionStr) as KVSession;

  // Re-hydrate Date Felder aus user
  if (session?.user?.createdAt) {
    session.user.createdAt = new Date(session.user.createdAt);
  }
  if (session?.user?.updatedAt) {
    session.user.updatedAt = new Date(session.user.updatedAt);
  }
  if (session?.user?.lastCreditRefreshAt) {
    session.user.lastCreditRefreshAt = new Date(session.user.lastCreditRefreshAt);
  }
  if (session?.user?.emailVerified) {
    session.user.emailVerified = new Date(session.user.emailVerified);
  }
  return session;
}

/* --------------------------------- Update --------------------------------- */

export async function updateKVSession(
  sessionId: string,
  userId: string,
  /** neue absolute Ablauffrist (z. B. jetzt + 30 Tage) */
  expiresAt: Date
): Promise<KVSession | null> {
  const session = await getKVSession(sessionId, userId);
  if (!session) return null;

  const updatedUser = await getUserFromDB(userId);
  if (!updatedUser) {
    throw new Error("User not found");
  }

  const updatedSession: KVSession = {
    ...session,
    version: CURRENT_SESSION_VERSION,
    expiresAt: expiresAt.getTime(),
    user: updatedUser,
  };

  const kv = await getKV();
  if (!kv) {
    throw new Error("Can't connect to KV store");
  }

  await kv.put(getSessionKey(userId, sessionId), JSON.stringify(updatedSession), {
    expirationTtl: ttlSecondsFromDate(expiresAt),
  });

  return updatedSession;
}

/**
 * Sliding-Refresh: verlängert die Session-Expiry um MAX_INACTIVITY_MS ab jetzt,
 * wenn die verbleibende TTL unter den Schwellwert fällt (Default: 7 Tage).
 * Keine Änderung, wenn genug TTL übrig ist.
 */
export async function touchKVSession(
  sessionId: string,
  userId: string,
  opts?: { thresholdMs?: number; extendMs?: number }
): Promise<KVSession | null> {
  const session = await getKVSession(sessionId, userId);
  if (!session) return null;

  const threshold = opts?.thresholdMs ?? MIN_TTL_REFRESH_MS;
  if (!shouldRefreshSessionTTL(session, threshold)) {
    return session; // nichts zu tun
  }

  const extendMs = opts?.extendMs ?? MAX_INACTIVITY_MS;
  const nextExpire = new Date(Date.now() + extendMs);
  return updateKVSession(sessionId, userId, nextExpire);
}

/* --------------------------------- Delete --------------------------------- */

export async function deleteKVSession(sessionId: string | undefined, userId: string): Promise<void> {
  if (!sessionId) return;
  const kv = await getKV();
  if (!kv) {
    throw new Error("Can't connect to KV store");
  }
  await kv.delete(getSessionKey(userId, sessionId));
}

/* ------------------------------ List sessions ----------------------------- */

export async function getAllSessionIdsOfUser(userId: string) {
  const kv = await getKV();
  if (!kv) {
    throw new Error("Can't connect to KV store");
  }
  const sessions = await kv.list({ prefix: getSessionKey(userId, "") });
  return sessions.keys.map((session) => ({
    key: session.name,
    absoluteExpiration: session.expiration ? new Date(session.expiration * 1000) : undefined,
  }));
}

/**
 * Update all sessions of a user.  This function iterates over all sessions and
 * writes the current user information back to the session.  Team data is no
 * longer maintained here, so only the user field is updated.
 */
export async function updateAllSessionsOfUser(userId: string) {
  const sessions = await getAllSessionIdsOfUser(userId);
  const kv = await getKV();
  if (!kv) {
    throw new Error("Can't connect to KV store");
  }
  const newUserData = await getUserFromDB(userId);
  if (!newUserData) return;

  for (const sessionObj of sessions) {
    const session = await kv.get(sessionObj.key);
    if (!session) continue;

    const sessionData = JSON.parse(session) as KVSession;

    if (sessionObj.absoluteExpiration && sessionObj.absoluteExpiration.getTime() > Date.now()) {
      const ttlInSeconds = Math.max(
        60,
        Math.floor((sessionObj.absoluteExpiration.getTime() - Date.now()) / 1000)
      );
      await kv.put(
        sessionObj.key,
        JSON.stringify({
          ...sessionData,
          user: newUserData,
          version: CURRENT_SESSION_VERSION,
        }),
        { expirationTtl: ttlInSeconds }
      );
    }
  }
}
