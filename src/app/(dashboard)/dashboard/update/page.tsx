import "server-only";
import { requireVerifiedEmail } from "@/utils/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { CreditPackages } from "./_components/credit-packages";
import { TransactionHistory } from "./_components/transaction-history";
import { getFreeMonthlyCredits, getReferralBonusCredits } from "@/lib/app-settings";

export default async function UpdatePage() {
  const session = await requireVerifiedEmail();
  if (!session) redirect("/sign-in");

  const [freeMonthlyCredits, referralBonusCredits] = await Promise.all([
    getFreeMonthlyCredits(),
    getReferralBonusCredits(),
  ]);

  return (
    <div className="p-6 w-full min-w-0 flex flex-col overflow-hidden space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 -mt-2">
        <PageHeader items={[{ href: "/dashboard/update", label: "Update" }]} />
      </div>

      {/* Credits & Packages */}
      <CreditPackages
        freeMonthlyCredits={freeMonthlyCredits}
        referralBonusCredits={referralBonusCredits}
      />

      {/* Transaction History */}
      <TransactionHistory />
    </div>
  );
}
