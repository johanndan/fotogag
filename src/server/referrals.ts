import { eq } from 'drizzle-orm';
import { getDB } from '@/db';
import { referralInvitationTable, userTable } from '@/db/schema';
import { REFERRAL_CREDITS, INVITEE_CREDITS } from '@/constants';
import { updateUserCredits } from '@/utils/credits';
import { createId } from '@paralleldrive/cuid2';
import { ZSAError } from 'zsa';

/**
 * Create a new referral invitation.  Generates a unique token, stores
 * the invitation in the database and triggers the sending of a referral
 * e‑mail.  If multiple invitations are sent to the same e‑mail, the
 * most recent one will be considered.
 *
 * @param email The e‑mail address of the invitee
 * @param inviterUserId The ID of the user sending the invitation
 */
export async function createReferralInvitation(email: string, inviterUserId: string): Promise<void> {
  const db = getDB();
  // Generate a unique token for the invitation
  const token = createId();
  // Insert the invitation into the referral invitation table
  await db.insert(referralInvitationTable).values({
    token,
    inviterUserId,
    invitedEmail: email,
    status: 'PENDING',
    expiresAt: null,
    creditsAwarded: REFERRAL_CREDITS,
  });
  // Optionally, fetch inviter to personalise the e‑mail.  Omit sensitive data
  const inviter = await db.query.userTable.findFirst({
    where: eq(userTable.id, inviterUserId),
    columns: {
      firstName: true,
      lastName: true,
      email: true,
    },
  });
  // Send the referral invitation e‑mail.  The implementation of sendReferralInvitationEmail
  // is assumed to exist in utils/email.  If not, this call can be adjusted.
  try {
    const { sendReferralInvitationEmail } = await import('@/utils/email');
    await sendReferralInvitationEmail({
      email,
      invitationToken: token,
      inviterName: inviter?.firstName || 'Someone',
    });
  } catch (error) {
    // Log the error but do not fail the invitation creation.  E‑mail sending
    // failures should not block referral functionality.
    console.error('Failed to send referral invitation e‑mail:', error);
  }
}

/**
 * Accept a referral invitation.  Marks the invitation as accepted,
 * associates the new user with the inviter and awards credits to both
 * parties.  Throws if the token is invalid or already used.
 *
 * @param token The unique invitation token
 * @param newUserId The ID of the user accepting the invitation
 */
export async function acceptReferralInvitation(token: string, newUserId: string): Promise<void> {
  const db = getDB();
  // Look up the invitation by token
  const invitation = await db.query.referralInvitationTable.findFirst({
    where: eq(referralInvitationTable.token, token),
  });
  if (!invitation) {
    throw new ZSAError('NOT_FOUND', 'Invalid invitation token');
  }
  if (invitation.status !== 'PENDING') {
    throw new ZSAError('PRECONDITION_FAILED', 'Invitation has already been used or expired');
  }
  // Mark the invitation as accepted
  await db.update(referralInvitationTable)
    .set({ status: 'ACCEPTED' })
    .where(eq(referralInvitationTable.id, invitation.id));
  // Set the referralUserId on the newly created user
  await db.update(userTable)
    .set({ referralUserId: invitation.inviterUserId as string })
    .where(eq(userTable.id, newUserId));
  // Award credits to the inviter and the invitee
  await updateUserCredits(invitation.inviterUserId, REFERRAL_CREDITS);
  await updateUserCredits(newUserId, INVITEE_CREDITS);
}