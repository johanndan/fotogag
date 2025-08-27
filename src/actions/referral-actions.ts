'use server';

import { requireVerifiedEmail } from '@/utils/auth';
import { createReferralInvitation, acceptReferralInvitation } from '@/server/referrals';
import { ZSAError } from 'zsa';

/**
 * Server action to invite a user by e‑mail.  Requires the current user to be
 * authenticated and have a verified e‑mail.  Delegates to
 * createReferralInvitation() and handles any errors according to the
 * ZSA/Next.js server action pattern.
 */
export async function inviteUserByEmailAction({ email }: { email: string }): Promise<{ success: boolean }> {
  try {
    const session = await requireVerifiedEmail();
    if (!session) {
      throw new ZSAError('NOT_AUTHORIZED', 'Not authenticated');
    }
    await createReferralInvitation(email, session.user.id);
    return { success: true };
  } catch (error: unknown) {
    // Re‑throw ZSAErrors so they are correctly propagated through the
    // server action boundary.  Wrap other errors in a generic ZSAError.
    if (error instanceof ZSAError) {
      throw error;
    }
    console.error('Failed to invite user by e‑mail:', error);
    throw new ZSAError('INTERNAL_SERVER_ERROR', 'Failed to send invitation');
  }
}

/**
 * Server action to accept a referral invitation.  The user must be
 * authenticated; this function assigns the referral and applies credits.
 */
export async function acceptReferralInvitationAction({ token }: { token: string }): Promise<{ success: boolean }> {
  try {
    const session = await requireVerifiedEmail();
    if (!session) {
      throw new ZSAError('NOT_AUTHORIZED', 'Not authenticated');
    }
    await acceptReferralInvitation(token, session.user.id);
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof ZSAError) {
      throw error;
    }
    console.error('Failed to accept referral invitation:', error);
    throw new ZSAError('INTERNAL_SERVER_ERROR', 'Failed to accept invitation');
  }
}