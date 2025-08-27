// src/app/(auth)/accept-referral/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import isProd from "@/utils/is-prod";

const REFERRAL_COOKIE = "referral_token";
const COOKIE_DOMAIN = "photogag.ai";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") ?? "").trim();
  const jar = await cookies();

  // vorhandenes Cookie gezielt entfernen: gleiche Attribute + maxAge: 0
  jar.set(REFERRAL_COOKIE, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    domain: `.${COOKIE_DOMAIN}`,
    maxAge: 0,
  });

  if (!token) {
    return NextResponse.redirect(new URL("/sign-up", url));
  }

  // neues Token 7 Tage setzen
  jar.set(REFERRAL_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    domain: `.${COOKIE_DOMAIN}`,
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.redirect(new URL("/sign-up?via=ref", url));
}
