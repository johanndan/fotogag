"use client";

import { useState } from 'react';
import { inviteUserByEmailAction } from '@/actions/referral-actions';

/**
 * A simple form component that allows a logged‑in user to send referral
 * invitations via e‑mail.  On submission it calls the
 * inviteUserByEmailAction server action and displays a status message.
 */
export default function InviteUserForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    try {
      await inviteUserByEmailAction({ email });
      setStatus('Invitation sent successfully.');
      setEmail('');
    } catch (error: unknown) {
      console.error('Failed to send invitation:', error);
      // Extract a message from unknown error objects in a type-safe way
      let message = 'Failed to send invitation.';
      if (error && typeof error === 'object' && 'message' in error) {
        const err = error as { message?: unknown };
        if (typeof err.message === 'string') {
          message = err.message;
        }
      }
      setStatus(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <label htmlFor="invite-email" className="font-medium">Invite via email</label>
      <input
        id="invite-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@example.com"
        required
        className="border border-gray-300 rounded px-2 py-1"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {isSubmitting ? 'Sending…' : 'Send Invitation'}
      </button>
      {status && <p className="text-sm text-gray-700">{status}</p>}
    </form>
  );
}