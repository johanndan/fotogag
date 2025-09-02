// src/app/accept-referral/route.ts
import { NextResponse } from "next/server";
import { getDB } from "@/db";
import { referralInvitationTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/sign-up?ref=missing", url));
  }

  const db = getDB();
  const invite = await db.query.referralInvitationTable.findFirst({
    where: eq(referralInvitationTable.token, token),
    columns: { status: true, invitedEmail: true, expiresAt: true },
  });

  const now = new Date();
  const isValid =
    !!invite &&
    invite.status === "PENDING" &&
    (!invite.expiresAt || invite.expiresAt > now);

  if (!isValid) {
    return NextResponse.redirect(new URL("/sign-up?ref=invalid", url));
  }

  // Zum Sign-Up; Modal öffnet sich (InviteSetupModal) nur bei invited=1 + gültigen Parametern
  const redirectTo = new URL("/sign-up", url);
  redirectTo.searchParams.set("invited", "1");
  redirectTo.searchParams.set("invitation", token);
  redirectTo.searchParams.set("email", invite!.invitedEmail);

  return NextResponse.redirect(redirectTo);
}
