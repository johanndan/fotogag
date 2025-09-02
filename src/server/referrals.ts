import { eq } from "drizzle-orm";
import { getDB } from "@/db";
import { referralInvitationTable, userTable, appSettingTable } from "@/db/schema";
import { updateUserCredits } from "@/utils/credits";
import { createId } from "@paralleldrive/cuid2";
import { ZSAError } from "zsa";

export async function createReferralInvitation(email: string, inviterUserId: string): Promise<void> {
  const db = getDB();
  const referralSetting = await db.query.appSettingTable.findFirst({
    where: eq(appSettingTable.key, "referral_bonus_credits"),
    columns: { value: true },
  });
  const referralBonus = Number(referralSetting?.value ?? 0);
  const token = createId();
  await db.insert(referralInvitationTable).values({
    token,
    inviterUserId,
    invitedEmail: email,
    status: "PENDING",
    expiresAt: null,
    creditsAwarded: referralBonus,
  });
  const inviter = await db.query.userTable.findFirst({
    where: eq(userTable.id, inviterUserId),
    columns: {
      firstName: true,
      lastName: true,
      email: true,
    },
  });
  try {
    const { sendReferralInvitationEmail } = await import("@/utils/email");
    await sendReferralInvitationEmail({
      email,
      invitationToken: token,
      inviterName: inviter?.firstName || "Someone",
    });
  } catch (error) {
    console.error("Failed to send referral invitation e‑mail:", error);
  }
}

export async function acceptReferralInvitation(token: string, newUserId: string): Promise<void> {
  const db = getDB();
  const invitation = await db.query.referralInvitationTable.findFirst({
    where: eq(referralInvitationTable.token, token),
  });
  if (!invitation) {
    throw new ZSAError("NOT_FOUND", "Invalid invitation token");
  }
  if (invitation.status !== "PENDING") {
    throw new ZSAError("PRECONDITION_FAILED", "Invitation has already been used or expired");
  }
  await db
    .update(referralInvitationTable)
    .set({ status: "ACCEPTED" })
    .where(eq(referralInvitationTable.id, invitation.id));
  await db
    .update(userTable)
    .set({ referralUserId: invitation.inviterUserId as string })
    .where(eq(userTable.id, newUserId));
  const [referralSetting, signupSetting] = await Promise.all([
    db.query.appSettingTable.findFirst({
      where: eq(appSettingTable.key, "referral_bonus_credits"),
      columns: { value: true },
    }),
    db.query.appSettingTable.findFirst({
      where: eq(appSettingTable.key, "default_registration_credits"),
      columns: { value: true },
    }),
  ]);
  const referralBonus = Number(referralSetting?.value ?? 0);
  const signupBonus = Number(signupSetting?.value ?? 0);
  if (referralBonus > 0) {
    await updateUserCredits(invitation.inviterUserId, referralBonus);
  }
  if (signupBonus > 0) {
    await updateUserCredits(newUserId, signupBonus);
  }
}
