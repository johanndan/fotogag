import { requireVerifiedEmail } from '@/utils/auth';
import { getDB } from '@/db';
import { referralInvitationTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import InviteUserForm from '@/components/invite-user-form';
import { PageHeader } from '@/components/page-header';

export default async function InviteDashboardPage() {
  const session = await requireVerifiedEmail();
  if (!session) return <div>Not authorized</div>;

  const db = getDB();
  const invites = await db.query.referralInvitationTable.findMany({
    where: eq(referralInvitationTable.inviterUserId, session.user.id),
    orderBy: (invitations, { desc }) => [desc(invitations.createdAt)],
    limit: 5,
  });

  return (
    <div className="p-6 w-full min-w-0 flex flex-col overflow-hidden space-y-6">
      {/* Header-Zeile wie im Screenshot – ohne Rahmen & ohne Hamburger */}
      <div className="flex items-center gap-2 -mt-2">
        {/* Breadcrumb */}
        <PageHeader items={[{ href: "/dashboard/invite", label: "Invite" }]} />
      </div>

      {/* Inhalt: Karten */}
      <section className="bg-base-100 border border-base-300 rounded-xl shadow-sm p-6">
        <h1 className="text-2xl">Invite friends</h1>
        <p className="text-base-content/70">

        </p>
        <div className="mt-4">
          <InviteUserForm />
        </div>
      </section>

      <section className="bg-base-100 border border-base-300 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your latest invitations</h2>
          {invites.length > 0 && <span className="badge badge-ghost">Last 5</span>}
        </div>

        {invites.length === 0 ? (
          <p className="text-base-content/70 mt-2">
            You have not sent any invitations yet.
          </p>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="table table-auto w-full">
              <thead>
                <tr className="text-base-content/70">
                  <th className="py-3 px-3 text-left">Email</th>
                  <th className="py-3 px-3 text-left">Status</th>
                  <th className="py-3 px-3 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => {
                  const status = (invite.status || '').toLowerCase();
                  const color =
                    status === 'accepted'
                      ? 'badge-success'
                      : status === 'pending' || status === 'sent'
                      ? 'badge-warning'
                      : status === 'failed'
                      ? 'badge-error'
                      : 'badge-ghost';
                  return (
                    <>
                      <tr key={invite.id} className="text-base-content/70">
                        <td className="align-middle py-3 px-3">{invite.invitedEmail}</td>
                        <td className="align-middle py-3 px-3">
                          <span className={`badge ${color} badge-sm capitalize`}>
                            {status || 'unknown'}
                          </span>
                        </td>
                        <td className="align-middle py-3 px-3">
                          {invite.createdAt
                            ? new Date(invite.createdAt).toLocaleDateString()
                            : ''}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="p-0">
                          <hr className="my-2 border-t border-gray-300 w-1/1 mx-auto" />
                        </td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
