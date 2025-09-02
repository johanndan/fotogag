// src/app/(dashboard)/dashboard/invite/page.tsx
import { requireVerifiedEmail } from '@/utils/auth';
import { getDB } from '@/db';
import { referralInvitationTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import InviteUserForm from '@/components/invite-user-form';

/**
 * Dashboard page for managing referral invitations. Users can send new
 * invitations via the InviteUserForm and view the status of previously
 * sent invitations.
 */
export default async function InviteDashboardPage() {
  // Ensure the user is signed in and e-mail verified
  const session = await requireVerifiedEmail();
  if (!session) {
    // Should never happen because requireVerifiedEmail throws, but return
    // fallback content to satisfy TypeScript
    return <div>Not authorized</div>;
  }

  const db = getDB();

  // Fetch only the 5 most recent invitations sent by the current user
  const invites = await db.query.referralInvitationTable.findMany({
    where: eq(referralInvitationTable.inviterUserId, session.user.id),
    orderBy: (invitations, { desc }) => [desc(invitations.createdAt)],
    limit: 5,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Invite Users</h1>
      <InviteUserForm />
      <div>
        <h2 className="text-xl font-semibold mt-8">Your latest invitations</h2>
        {invites.length === 0 ? (
          <p className="text-gray-600 mt-2">You have not sent any invitations yet.</p>
        ) : (
          <table className="mt-4 w-full border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 px-1">Email</th>
                <th className="py-2 px-1">Status</th>
                <th className="py-2 px-1">Created</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id} className="border-b">
                  <td className="py-2 px-1">{invite.invitedEmail}</td>
                  <td className="py-2 px-1">{invite.status}</td>
                  <td className="py-2 px-1">
                    {invite.createdAt ? new Date(invite.createdAt).toLocaleDateString() : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
