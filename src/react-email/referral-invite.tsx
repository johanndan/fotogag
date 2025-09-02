import * as React from 'react';
import { SITE_NAME, SITE_URL } from '@/constants';

export interface ReferralInviteEmailProps {
  invitationToken: string;
  inviterName?: string;
  inviterBonusCredits: number;
  inviteeCredits: number;
}

const ReferralInviteEmail: React.FC<ReferralInviteEmailProps> = ({
  invitationToken,
  inviterName,
  inviterBonusCredits,
  inviteeCredits,
}) => {
  const acceptUrl = `${SITE_URL}/accept-referral?token=${invitationToken}`;
  return (
    <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 16, color: '#333', lineHeight: 1.4 }}>
      <h1 style={{ fontSize: 24, marginBottom: '0.5em' }}>
        You&apos;ve been invited to {SITE_NAME}!
      </h1>
      {inviterName && (
        <p style={{ marginBottom: '1em' }}>
          <strong>{inviterName}</strong> has invited you to try {SITE_NAME}.
        </p>
      )}
      <p style={{ marginBottom: '1em' }}>
        Sign up today and receive a welcome bonus of <strong>{inviteeCredits} credits</strong>. Your inviter will also
        receive <strong>{inviterBonusCredits} credits</strong> once you&apos;ve created your account.
      </p>
      <p style={{ marginBottom: '1em' }}>
        With our credits you can start immediately, with no hidden costs and cancel any time.
      </p>
      <p style={{ marginBottom: '2em' }}>
        To accept the invitation, simply click the following link and register:
      </p>
      <p>
        <a
          href={acceptUrl}
          style={{ display: 'inline-block', padding: '12px 20px', backgroundColor: '#2563eb', color: '#ffffff', textDecoration: 'none', borderRadius: '5px' }}
        >
          Accept invitation
        </a>
      </p>
      <p style={{ marginTop: '2em', fontSize: 12, color: '#666' }}>
        If you can&apos;t click the button, copy this link into your browser: {acceptUrl}
      </p>
    </div>
  );
};

export default ReferralInviteEmail;
