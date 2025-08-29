// src/app/accept-referral/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDB } from "@/db";
import { referralInvitationTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const REF_COOKIE = "referral_token";
const REF_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 Tage

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const backTo = new URL("/sign-up?via=ref", url);

  if (!token) return NextResponse.redirect(backTo);

  const db = getDB();

  // optional: Token existiert / gehört zu einer Einladung?
  const inv = await db.query.referralInvitationTable.findFirst({
    where: and(
      eq(referralInvitationTable.token, token),
      // wenn du E-Mail beim Aufruf noch nicht weißt, nur token prüfen:
      // eq(referralInvitationTable.status, "PENDING")
    ),
  });

  if (!inv) return NextResponse.redirect(backTo);

  // Cookie setzen – NUR hier (Route Handler ist erlaubt)
  const jar = await cookies();
  jar.set(REF_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: REF_COOKIE_MAX_AGE_SEC,
  });

  return NextResponse.redirect(backTo);
}
