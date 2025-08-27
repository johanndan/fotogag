// src/app/(auth)/sso/google/callback/finalize/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDB } from "@/db";
import { userTable, type User } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getGoogleSSOClient } from "@/lib/sso/google-sso";
import {
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME,
  REDIRECT_AFTER_SIGN_IN,
} from "@/constants";
import {
  createSession,
  generateSessionToken,
  setSessionTokenCookie,
  canSignUp,
} from "@/utils/auth";
import { getIP } from "@/utils/get-IP";
import { withRateLimit, RATE_LIMITS } from "@/utils/with-rate-limit";
import { consumeReferralOnSignup } from "@/utils/referrals";

export async function GET(req: Request) {
  return withRateLimit(async () => {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    const jar = await cookies();
    const storedState = jar.get(GOOGLE_OAUTH_STATE_COOKIE_NAME)?.value;
    const codeVerifier = jar.get(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME)?.value;

    // Einmal-Cookies leeren (auch bei Fehlern)
    jar.delete(GOOGLE_OAUTH_STATE_COOKIE_NAME);
    jar.delete(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME);

    if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
      return NextResponse.redirect(new URL("/", url));
    }

    const google = getGoogleSSOClient();
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);

    // UserInfo laden
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!res.ok) {
      return NextResponse.redirect(new URL("/", url));
    }
    const profile = (await res.json()) as {
      email?: string;
      given_name?: string;
      family_name?: string;
    };

    const email = (profile.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.redirect(new URL("/", url));
    }

    const db = getDB();
    let user = await db.query.userTable.findFirst({
      where: eq(userTable.email, email),
    });

    // Neu anlegen, falls nicht vorhanden
    let isNew = false;
    if (!user) {
      await canSignUp({ email });
      const insertResult = await db
        .insert(userTable)
        .values({
          email,
          firstName: profile.given_name,
          lastName: profile.family_name,
          signUpIpAddress: await getIP(),
        })
        .returning();

      user = Array.isArray(insertResult)
        ? (insertResult[0] as unknown as User)
        : ((insertResult as unknown as { [k: number]: unknown })[0] as User);

      isNew = true;
    }

    if (!user) {
      return NextResponse.redirect(new URL("/", url));
    }

    // Referral nur bei Neuanlage idempotent einlösen
    if (isNew) {
      try {
        await consumeReferralOnSignup({ email: user.email!, userId: user.id });
      } catch (e) {
        console.error("[referral] consumeReferralOnSignup failed:", e);
      }
    }

    // Session setzen (Union-Typ erwartet "google-oauth")
    const sessionToken = generateSessionToken();
    const session = await createSession({
      token: sessionToken,
      userId: user.id,
      authenticationType: "google-oauth",
    });
    await setSessionTokenCookie({
      token: sessionToken,
      userId: user.id,
      expiresAt: new Date(session.expiresAt),
    });

    return NextResponse.redirect(new URL(REDIRECT_AFTER_SIGN_IN, url));
  }, RATE_LIMITS.GOOGLE_SSO_CALLBACK);
}
