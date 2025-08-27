// src/utils/auth.ts
import "server-only";
import { ROLES_ENUM, userTable } from "@/db/schema";
import { init } from "@paralleldrive/cuid2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import ms from "ms";
import { getDB } from "@/db";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import isProd from "@/utils/is-prod";
import {
  createKVSession,
  deleteKVSession,
  type KVSession,
  type CreateKVSessionParams,
  getKVSession,
  updateKVSession,
  CURRENT_SESSION_VERSION
} from "./kv-session";
import { cache } from "react";
import type { SessionValidationResult } from "@/types";
import { SESSION_COOKIE_NAME } from "@/constants";
import { ZSAError } from "zsa";
import { addFreeMonthlyCreditsIfNeeded } from "./credits";
import { getInitials } from "./name-initials";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const getSessionLength = () => ms("30d");

// KV-Key-Prefix für den per-User Session-Index
const USER_SESSION_INDEX_PREFIX = "user-session";

export async function getUserFromDB(userId: string) {
  const db = getDB();
  return await db.query.userTable.findFirst({
    where: eq(userTable.id, userId),
    columns: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      emailVerified: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
      currentCredits: true,
      lastCreditRefreshAt: true,
      referralUserId: true,
    },
  });
}

const createId = init({ length: 32 });

export function generateSessionToken(): string {
  return createId();
}

async function generateSessionId(token: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return encodeHexLowerCase(new Uint8Array(hashBuffer));
}

function encodeSessionCookie(userId: string, token: string): string {
  return `${userId}:${token}`;
}

function decodeSessionCookie(cookie: string): { userId: string; token: string } | null {
  const parts = cookie.split(":");
  if (parts.length !== 2) return null;
  return { userId: parts[0], token: parts[1] };
}

interface CreateSessionParams extends Pick<CreateKVSessionParams, "authenticationType" | "passkeyCredentialId" | "userId"> {
  token: string;
}

/** Session erzeugen + per-User-Index in KV pflegen. */
export async function createSession({
  token,
  userId,
  authenticationType,
  passkeyCredentialId
}: CreateSessionParams): Promise<KVSession> {
  const sessionId = await generateSessionId(token);
  const expiresAt = new Date(Date.now() + getSessionLength());

  const user = await getUserFromDB(userId);
  if (!user) throw new Error("User not found");

  // 1) Session speichern
  const session = await createKVSession({
    sessionId,
    userId,
    expiresAt,
    user,
    authenticationType,
    passkeyCredentialId,
  });

  // 2) Index-Key in KV anlegen (best effort)
  try {
    const { env } = getCloudflareContext();
    if (env?.NEXT_INC_CACHE_KV) {
      await env.NEXT_INC_CACHE_KV.put(
        `${USER_SESSION_INDEX_PREFIX}:${userId}:${sessionId}`,
        "1",
        { expiration: Math.floor(expiresAt.getTime() / 1000) }
      );
    }
  } catch (err) {
    console.error("Failed to index session in KV:", err);
  }

  return session;
}

export async function createAndStoreSession(
  userId: string,
  authenticationType?: CreateKVSessionParams["authenticationType"],
  passkeyCredentialId?: CreateKVSessionParams["passkeyCredentialId"]
) {
  const sessionToken = generateSessionToken();
  const session = await createSession({
    token: sessionToken,
    userId,
    authenticationType,
    passkeyCredentialId
  });
  await setSessionTokenCookie({
    token: sessionToken,
    userId,
    expiresAt: new Date(session.expiresAt)
  });
}

async function validateSessionToken(token: string, userId: string): Promise<SessionValidationResult | null> {
  const sessionId = await generateSessionId(token);
  let session = await getKVSession(sessionId, userId);
  if (!session) return null;

  // Abgelaufen?
  if (Date.now() >= session.expiresAt) {
    await deleteKVSession(sessionId, userId);
    return null;
  }

  // Version refreshen?
  if (!session.version || session.version !== CURRENT_SESSION_VERSION) {
    const updatedSession = await updateKVSession(sessionId, userId, new Date(session.expiresAt));
    if (!updatedSession) return null;
    session = updatedSession;
  }

  // Monatliche Credits ggf. auffrischen
  const currentCredits = await addFreeMonthlyCreditsIfNeeded(session);
  if (session?.user?.currentCredits && currentCredits !== session.user.currentCredits) {
    session.user.currentCredits = currentCredits;
  }

  // Initialen für UI
  session.user.initials = getInitials(`${session.user.firstName} ${session.user.lastName}`);
  return session;
}

export async function invalidateSession(sessionId: string, userId: string): Promise<void> {
  await deleteKVSession(sessionId, userId);
  try {
    const { env } = getCloudflareContext();
    if (env?.NEXT_INC_CACHE_KV) {
      await env.NEXT_INC_CACHE_KV.delete(`${USER_SESSION_INDEX_PREFIX}:${userId}:${sessionId}`);
    }
  } catch (err) {
    console.warn("Failed to delete session index key:", err);
  }
}

/** Invalidiert ALLE Sessions eines Users (bei Admin-Delete etc.) */
type KVListResult = {
  keys: { name: string; expiration?: number; metadata?: unknown }[];
  list_complete: boolean;
  cursor?: string;
};

export async function invalidateAllSessionsForUser(userId: string): Promise<void> {
  try {
    const { env } = getCloudflareContext();
    if (!env?.NEXT_INC_CACHE_KV) return;

    const prefix = `user-session:${userId}:`;
    let cursor: string | undefined = undefined;

    do {
      const res = (await env.NEXT_INC_CACHE_KV.list({
        prefix,
        cursor,
      })) as KVListResult;

      const { keys, list_complete, cursor: nextCursor } = res;

      for (const k of keys) {
        // k.name z.B. "user-session:<userId>:<sessionId>"
        const parts = k.name.split(":");
        const sessionId = parts[2];
        if (!sessionId) continue;
        await deleteKVSession(sessionId, userId);
        await env.NEXT_INC_CACHE_KV.delete(k.name);
      }

      cursor = list_complete ? undefined : nextCursor;
    } while (cursor);
  } catch (err) {
    console.error("Failed to invalidate all sessions for user:", err);
  }
}


interface SetSessionTokenCookieParams {
  token: string;
  userId: string;
  expiresAt: Date;
}

export async function setSessionTokenCookie({ token, userId, expiresAt }: SetSessionTokenCookieParams): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, encodeSessionCookie(userId, token), {
    httpOnly: true,
    sameSite: isProd ? "strict" : "lax",
    secure: isProd,
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSessionTokenCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** Session aus Cookie lesen/validieren – ungültige Cookies sofort entsorgen. */
export const getSessionFromCookie = cache(async (): Promise<SessionValidationResult | null> => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  const decoded = decodeSessionCookie(sessionCookie);
  if (!decoded || !decoded.token || !decoded.userId) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  const session = await validateSessionToken(decoded.token, decoded.userId);
  if (!session) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }
  return session;
});

export const requireVerifiedEmail = cache(async ({ doNotThrowError = false }: { doNotThrowError?: boolean } = {}) => {
  const session = await getSessionFromCookie();
  if (!session) throw new ZSAError("NOT_AUTHORIZED", "Not authenticated");
  if (!session?.user?.emailVerified) {
    if (doNotThrowError) return null;
    throw new ZSAError("FORBIDDEN", "Please verify your email first");
  }
  return session;
});

export const requireAdmin = cache(async ({ doNotThrowError = false }: { doNotThrowError?: boolean } = {}) => {
  const session = await getSessionFromCookie();
  if (!session) throw new ZSAError("NOT_AUTHORIZED", "Not authenticated");
  if (session.user.role !== ROLES_ENUM.ADMIN) {
    if (doNotThrowError) return null;
    throw new ZSAError("FORBIDDEN", "Not authorized");
  }
  return session;
});

/* ===========================
   (Re-)Export canSignUp helper
   =========================== */

type DisposableEmailResponse = { disposable: string };
type MailcheckResponse = {
  status: number; email: string; domain: string; mx: boolean; disposable: boolean;
  public_domain: boolean; relay_domain: boolean; alias: boolean; role_account: boolean; did_you_mean: string | null;
};

async function checkWithDebounce(email: string): Promise<{ success: boolean; isDisposable: boolean }> {
  try {
    const res = await fetch(`https://disposable.debounce.io/?email=${encodeURIComponent(email)}`);
    if (!res.ok) return { success: false, isDisposable: false };
    const data = (await res.json()) as DisposableEmailResponse;
    return { success: true, isDisposable: data.disposable === "true" };
  } catch {
    return { success: false, isDisposable: false };
  }
}

async function checkWithMailcheck(email: string): Promise<{ success: boolean; isDisposable: boolean }> {
  try {
    const res = await fetch(`https://api.mailcheck.ai/email/${encodeURIComponent(email)}`);
    if (!res.ok) return { success: false, isDisposable: false };
    const data = (await res.json()) as MailcheckResponse;
    return { success: true, isDisposable: data.disposable };
  } catch {
    return { success: false, isDisposable: false };
  }
}

export async function canSignUp({ email }: { email: string }): Promise<void> {
  if (!isProd) return; // in DEV nicht prüfen
  const validators = [checkWithDebounce, checkWithMailcheck];
  for (const v of validators) {
    const r = await v(email);
    if (!r.success) continue;
    if (r.isDisposable) {
      throw new ZSAError("PRECONDITION_FAILED", "Disposable email addresses are not allowed");
    }
    return;
  }
  throw new ZSAError(
    "PRECONDITION_FAILED",
    "Unable to verify email address at this time. Please try again later."
  );
}
