// /src/utils/kv-session.ts
import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";

import { getUserFromDB } from "@/utils/auth";
import { getIP } from "./get-IP";
import { MAX_SESSIONS_PER_USER } from "@/constants";
const SESSION_PREFIX = "session:";

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

export interface CreateKVSessionParams extends Omit<KVSession, "id" | "createdAt" | "expiresAt"> {
  sessionId: string;
  expiresAt: Date;
}

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
    userAgent: headersList.get('user-agent'),
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
    const oldestSessionId = oldestSessionKey?.split(':')?.[2];
    await deleteKVSession(oldestSessionId, userId);
  }
  await kv.put(
    getSessionKey(userId, sessionId),
    JSON.stringify(session),
    {
      expirationTtl: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    },
  );
  return session;
}

export async function getKVSession(sessionId: string, userId: string): Promise<KVSession | null> {
  const kv = await getKV();
  if (!kv) {
    throw new Error("Can't connect to KV store");
  }
  const sessionStr = await kv.get(getSessionKey(userId, sessionId));
  if (!sessionStr) return null;
  const session = JSON.parse(sessionStr) as KVSession;
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

export async function updateKVSession(sessionId: string, userId: string, expiresAt: Date): Promise<KVSession | null> {
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
  await kv.put(
    getSessionKey(userId, sessionId),
    JSON.stringify(updatedSession),
    {
      expirationTtl: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    },
  );
  return updatedSession;
}

export async function deleteKVSession(sessionId: string, userId: string): Promise<void> {
  const session = await getKVSession(sessionId, userId);
  if (!session) return;
  const kv = await getKV();
  if (!kv) {
    throw new Error("Can't connect to KV store");
  }
  await kv.delete(getSessionKey(userId, sessionId));
}

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
      const ttlInSeconds = Math.floor((sessionObj.absoluteExpiration.getTime() - Date.now()) / 1000);
      await kv.put(
        sessionObj.key,
        JSON.stringify({
          ...sessionData,
          user: newUserData,
          version: CURRENT_SESSION_VERSION,
        }),
        { expirationTtl: ttlInSeconds },
      );
    }
  }
}