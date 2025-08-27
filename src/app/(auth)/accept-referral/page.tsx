import { acceptReferralInvitationAction } from '@/actions/referral-actions';
import { redirect } from 'next/navigation';

interface AcceptReferralPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * This page is accessed via a link sent in a referral e‑mail.  It reads
 * the invitation token from the query string and calls the server
 * action to accept the invitation.  After processing, it redirects
 * the user to the dashboard.  If the user is not authenticated, the
 * underlying server action will throw a NOT_AUTHORIZED error.
 */
export default async function AcceptReferralPage({ searchParams }: AcceptReferralPageProps) {
  const params = await searchParams;
  const tokenParam = params?.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

  if (token) {
    try {
      await acceptReferralInvitationAction({ token });
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      // Swallow the error and continue redirecting to avoid exposing errors
    }
  }

  redirect('/dashboard');
}