import { PageHeader } from "@/components/page-header";
import { Alert } from "@heroui/react";
import MarketplaceCard from "@/components/marketplace-card";
import { getSessionFromCookie } from "@/utils/auth";
import { getUserPurchasedItems } from "@/utils/credits";
// Import static metadata for marketplace components. This avoids importing
// client‑side preview functions into the server environment. See
// components-metadata.ts for details.
import { COMPONENT_METADATA } from "@/lib/marketplace-metadata";

export default async function MarketplacePage() {
  const session = await getSessionFromCookie();
  const purchasedItems = session ? await getUserPurchasedItems(session.userId) : new Set<string>();

  return (
    <>
      <PageHeader
        items={[
          {
            href: "/dashboard/marketplace",
            label: "Update",
          },
        ]}
      />
      <div className="container mx-auto px-5 pb-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mt-4">Account Update</h1>
          <p className="text-muted-foreground mt-2">
            Purchase and use our premium update using your credits
          </p>
        </div>

        <Alert
          color="warning"
          title="Hier werden die Kaufpakette dargestellt"
          description="Das ist ein Platzhalter für einen passenden Text, der zum kauf animieren soll."
          className="mb-6"
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {COMPONENT_METADATA.map((meta) => (
            <MarketplaceCard
              key={meta.id}
              id={meta.id}
              name={meta.name}
              description={meta.description}
              credits={meta.credits}
              containerClass={meta.containerClass}
              isPurchased={purchasedItems.has(`COMPONENT:${meta.id}`)}
            />
          ))}
        </div>
      </div>
    </>
  );
}