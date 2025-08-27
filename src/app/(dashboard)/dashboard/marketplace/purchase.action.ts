"use server"

import { createServerAction, ZSAError } from "zsa";
import { z } from "zod";
import { getSessionFromCookie } from "@/utils/auth";
import { withRateLimit, RATE_LIMITS } from "@/utils/with-rate-limit";
import { hasEnoughCredits, consumeCredits } from "@/utils/credits";
import { getDB } from "@/db";
import { purchasedItemsTable, PURCHASABLE_ITEM_TYPE } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// Import static metadata for marketplace components. This metadata is safe to
// consume within a server action because it does not include any client‑side
// code. Each entry defines the id, name and credit cost for a component.
import { COMPONENT_METADATA } from "@/lib/marketplace-metadata";

// Define the expected payload for the purchase action. Currently only
// components can be purchased. If additional item types are added in the
// future, extend the enum accordingly.
const purchaseSchema = z.object({
  itemId: z.string(),
  itemType: z.enum([PURCHASABLE_ITEM_TYPE.COMPONENT]),
});

export const purchaseAction = createServerAction()
  .input(purchaseSchema)
  .handler(async ({ input }) => {
    return withRateLimit(
      async () => {
        const session = await getSessionFromCookie();
        if (!session) {
          throw new ZSAError(
            "NOT_AUTHORIZED",
            "You must be logged in to make purchases"
          );
        }

        // Resolve item details from static metadata based on type and id. Only
        // COMPONENT items are currently supported.
        let itemDetails: { name: string; credits: number } | undefined;
        switch (input.itemType) {
          case PURCHASABLE_ITEM_TYPE.COMPONENT: {
            const meta = COMPONENT_METADATA.find((c) => c.id === input.itemId);
            if (meta) {
              itemDetails = { name: meta.name, credits: meta.credits };
            }
            break;
          }
          default:
            // In case of an unsupported type, fail early
            itemDetails = undefined;
            break;
        }

        if (!itemDetails) {
          throw new ZSAError("NOT_FOUND", "Item not found");
        }

        // Check if the user has enough credits to purchase the item
        const hasCredits = await hasEnoughCredits({
          userId: session.userId,
          requiredCredits: itemDetails.credits,
        });
        if (!hasCredits) {
          throw new ZSAError(
            "INSUFFICIENT_CREDITS",
            "You don't have enough credits to purchase this item"
          );
        }

        const db = getDB();
        // Ensure the user doesn't already own the item
        const existingPurchase = await db.query.purchasedItemsTable.findFirst({
          where: and(
            eq(purchasedItemsTable.userId, session.userId),
            eq(purchasedItemsTable.itemType, input.itemType),
            eq(purchasedItemsTable.itemId, input.itemId)
          ),
        });
        if (existingPurchase) {
          throw new ZSAError("CONFLICT", "You already own this item");
        }

        // Deduct credits from the user's balance
        await consumeCredits({
          userId: session.userId,
          amount: itemDetails.credits,
          description: `Purchased ${input.itemType.toLowerCase()}: ${itemDetails.name}`,
        });

        // Record the purchase in the database
        await db.insert(purchasedItemsTable).values({
          userId: session.userId,
          itemType: input.itemType,
          itemId: input.itemId,
        });

        return { success: true };
      },
      RATE_LIMITS.PURCHASE
    );
  });