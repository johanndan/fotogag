"use client";

import * as React from "react";
import PurchaseButton from "@/components/purchase-button";
import type { PURCHASABLE_ITEM_TYPE } from "@/db/schema";
import { COMPONENTS } from "@/app/(dashboard)/dashboard/marketplace/components-catalog";

interface MarketplaceCardProps {
  id: string;
  name: string;
  description: string;
  credits: number;
  containerClass?: string;
  isPurchased: boolean;
}

const ITEM_TYPE = "COMPONENT" as const satisfies keyof typeof PURCHASABLE_ITEM_TYPE;

export default function MarketplaceCard({
  id,
  name,
  description,
  credits,
  containerClass,
  isPurchased,
}: MarketplaceCardProps) {
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