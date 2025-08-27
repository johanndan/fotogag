"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PURCHASABLE_ITEM_TYPE } from "@/db/schema";
import { purchaseAction } from "@/app/(dashboard)/dashboard/marketplace/purchase.action";
// We use a basic button from the UI library if available; otherwise fall
// back to a native button with styling. If your project defines a custom
// button component, import it here instead.
import { Button } from "@/components/ui/button";

interface PurchaseButtonProps {
  itemId: string;
  itemType: keyof typeof PURCHASABLE_ITEM_TYPE;
}

/**
 * PurchaseButton triggers a purchase server action when clicked. It shows
 * loading state while the purchase is in progress and refreshes the router
 * once the action completes. Errors are logged to the console and surfaced
 * via a basic alert; you may replace this with a proper toast or
 * notification system.
 */
export default function PurchaseButton({ itemId, itemType }: PurchaseButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isProcessing, setProcessing] = useState(false);

  async function handleClick() {
    startTransition(async () => {
      setProcessing(true);
      try {
        // Invoke the server action with the provided itemId and type
        await purchaseAction({ itemId, itemType });
        // Refresh the page to update credit balances and purchase state
        router.refresh();
      } catch (err: unknown) {
        // Narrow the error type to a shape with an optional err.message
        const errorObj = err as { err?: { message?: string } };
        console.error(err);
        // Use a basic alert for errors; replace with toast if available
        alert(errorObj.err?.message ?? "Failed to purchase item");
      } finally {
        setProcessing(false);
      }
    });
  }

  return (
    <Button onClick={handleClick} disabled={isPending || isProcessing}>
      {isPending || isProcessing ? "Processing…" : "Purchase"}
    </Button>
  );
}