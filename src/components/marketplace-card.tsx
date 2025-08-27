"use client";

import * as React from "react";
// We intentionally avoid importing any UI components that may not exist in
// this stripped‑down template. Instead we build the card using plain
// semantic HTML elements and utility classes. If you reintroduce a UI
// library, you can replace these elements with the appropriate components.
import PurchaseButton from "@/components/purchase-button";
import type { PURCHASABLE_ITEM_TYPE } from "@/db/schema";
// Import the client‑side list of components so that we can render the
// preview. This file is marked "use client" and thus can safely import
// other client modules.
import { COMPONENTS } from "@/app/(dashboard)/dashboard/marketplace/components-catalog";

interface MarketplaceCardProps {
  id: string;
  name: string;
  description: string;
  credits: number;
  containerClass?: string;
  isPurchased: boolean;
}

// The only purchasable item type currently supported in this app. Should
// match the keys of PURCHASABLE_ITEM_TYPE. Using a constant ensures the
// string literal is typed correctly.
const ITEM_TYPE = "COMPONENT" as const satisfies keyof typeof PURCHASABLE_ITEM_TYPE;

/**
 * MarketplaceCard renders information about a purchasable item. It displays
 * the name, description, preview, cost, and a purchase button if the item
 * hasn't already been bought. When a purchase is initiated, it calls the
 * server action via the PurchaseButton component and refreshes the page to
 * reflect the updated credit balance.
 */
export default function MarketplaceCard({
  id,
  name,
  description,
  credits,
  containerClass,
  isPurchased,
}: MarketplaceCardProps) {
  // Find the corresponding component definition to render its preview.
  const component = COMPONENTS.find((c) => c.id === id);
  if (!component) return null;

  return (
    <div className="border rounded shadow-sm bg-card text-card-foreground">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{name}</h3>
          {isPurchased && (
            <span className="px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded">
              Purchased
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="p-6 bg-muted/50 flex justify-center">
        <div className={containerClass}>{component.preview()}</div>
      </div>
      <div className="p-4 border-t flex justify-between items-center">
        <span className="text-md lg:text-2xl font-bold">{credits} credits</span>
        {!isPurchased && (
          <PurchaseButton itemId={id} itemType={ITEM_TYPE} />
        )}
      </div>
    </div>
  );
}