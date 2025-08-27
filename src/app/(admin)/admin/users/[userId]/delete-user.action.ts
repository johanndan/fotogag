"use server";

import { createServerAction, ZSAError } from "zsa";
import { z } from "zod";
import { getDB } from "@/db";
import {
  userTable,
  purchasedItemsTable,
  creditTransactionTable,
  referralInvitationTable,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, invalidateAllSessionsForUser } from "@/utils/auth";
import { withRateLimit, RATE_LIMITS } from "@/utils/with-rate-limit";

export const deleteUserAction = createServerAction()
  .input(z.object({ userId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const session = await requireAdmin();
    if (session && session.user.id === input.userId) {
      throw new ZSAError("FORBIDDEN", "You cannot delete your own account.");
    }

    const db = getDB();

    return withRateLimit(
      async () => {
        const existing = await db.query.userTable.findFirst({
          where: eq(userTable.id, input.userId),
        });
        if (!existing) {
          throw new ZSAError("NOT_FOUND", "User not found");
        }

        await invalidateAllSessionsForUser(input.userId);

        await db
          .delete(creditTransactionTable)
          .where(eq(creditTransactionTable.userId, input.userId));

        await db
          .delete(purchasedItemsTable)
          .where(eq(purchasedItemsTable.userId, input.userId));

        await db
          .delete(referralInvitationTable)
          .where(eq(referralInvitationTable.inviterUserId, input.userId));

        await db
          .update(userTable)
          .set({ referralUserId: null })
          .where(eq(userTable.referralUserId, input.userId));

        await db.delete(userTable).where(eq(userTable.id, input.userId));

        return { success: true };
      },
      RATE_LIMITS.PURCHASE
    );
  });
