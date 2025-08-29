// src/app/(auth)/sso/google/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDB } from "@/db";
import {
  userTable,
  type User,
  creditTransactionTable,
  CREDIT_TRANSACTION_TYPE,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
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
          lastCreditRefreshAt: new Date(), // Initialwert setzen
        })
        .returning();

      user = Array.isArray(insertResult)
        ? (insertResult[0] as unknown as User)
        : ((insertResult as unknown as { [k: number]: unknown })[0] as User);

      isNew = true;

      // Sign-up Bonus (30) genau einmal, idempotent
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
            // COALESCE gegen NULL
            currentCredits: sql`COALESCE(${userTable.currentCredits}, 0) + 30`,
            updatedAt: new Date(),
          })
          .where(eq(userTable.id, user.id));
      }
    }

    if (!user) {
      return NextResponse.redirect(new URL("/", url));
    }

    // WICHTIG: Referral einlösen nur bei Neuanlage (Invitee erhält KEINE Extracredits –
    // das macht die implementierte referrals-Logik; nur der Einlader bekommt 50)
    if (isNew) {
      try {
        await consumeReferralOnSignup({ email: user.email!, userId: user.id });
      } catch (e) {
        console.error("[referral] consumeReferralOnSignup failed:", e);
      }
    }

    // Session setzen (korrekter Typ!)
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
