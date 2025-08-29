import * as React from 'react';
import { SITE_NAME, SITE_URL, REFERRAL_CREDITS, INVITEE_CREDITS } from '@/constants';

export interface ReferralInviteEmailProps {
  invitationToken: string;
  inviterName?: string;
}

const ReferralInviteEmail: React.FC<ReferralInviteEmailProps> = ({
  invitationToken,
  inviterName,
}) => {
  const acceptUrl = `${SITE_URL}/accept-referral?token=${invitationToken}`;
  return (
    <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: 16, color: '#333', lineHeight: 1.4 }}>
      <h1 style={{ fontSize: 24, marginBottom: '0.5em' }}>Du wurdest zu {SITE_NAME} eingeladen!</h1>
      {inviterName && (
        <p style={{ marginBottom: '1em' }}><strong>{inviterName}</strong> hat dich eingeladen, {SITE_NAME} auszuprobieren.</p>
      )}
      <p style={{ marginBottom: '1em' }}>
        Melde dich noch heute an und erhalte als Willkommensbonus <strong>{INVITEE_CREDITS} Credits</strong>. Dein
        Einladender erhält ebenfalls <strong>{REFERRAL_CREDITS} Credits</strong>, sobald du dein Konto angelegt hast.
      </p>
      <p style={{ marginBottom: '1em' }}>
        Mit unseren Credits kannst du sofort loslegen – ohne versteckte Kosten und jederzeit kündbar.
      </p>
      <p style={{ marginBottom: '2em' }}>
        Um die Einladung anzunehmen, klicke einfach auf den folgenden Link und registriere dich:
      </p>
      <p>
        <a
          href={acceptUrl}
          style={{ display: 'inline-block', padding: '12px 20px', backgroundColor: '#2563eb', color: '#ffffff', textDecoration: 'none', borderRadius: '5px' }}
        >
          Einladung annehmen
        </a>
      </p>
      <p style={{ marginTop: '2em', fontSize: 12, color: '#666' }}>
        Wenn du den Button nicht anklicken kannst, kopiere diesen Link in deinen Browser: {acceptUrl}
      </p>
    </div>
  );
};

export default ReferralInviteEmail;