// src/app/(admin)/admin/users/[userId]/delete-user.action.ts
"use server";

import { z } from "zod";
import { createServerAction, ZSAError } from "zsa";
import { getDB } from "@/db";
import {
  userTable,
  creditTransactionTable,
  referralInvitationTable, // vorhanden in deinem Schema
} from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";

export const deleteUserAction = createServerAction()
  .input(z.object({ userId: z.string().min(1) }))
  .handler(async ({ input }) => {
    const db = getDB();

    const user = await db.query.userTable.findFirst({
      where: eq(userTable.id, input.userId),
      columns: { id: true, email: true },
    });
    if (!user) throw new ZSAError("NOT_FOUND", "User not found");

    // 1) Kredit-Transaktionen löschen (Quelle der Balance)
    await db.delete(creditTransactionTable).where(
      eq(creditTransactionTable.userId, user.id)
    );

    // 2) Tabellen, die nicht im Drizzle-Schema exportiert sind → Raw SQL
    //    Wichtig: db.run(sql`...`) (nicht execute)
    try {
      await db.run(sql`DELETE FROM passkey_credential WHERE userId = ${user.id}`);
    } catch {}
    try {
      await db.run(sql`DELETE FROM purchased_item WHERE userId = ${user.id}`);
    } catch {}

    // 3) Referral-Einladungen in beiden Varianten entfernen
    //    a) camelCase Tabelle aus Migration 0010 (im Schema exportiert)
    try {
      await db.delete(referralInvitationTable).where(
        or(
          eq(referralInvitationTable.inviterUserId, user.id),
          eq(referralInvitationTable.invitedEmail, user.email ?? "")
        )
      );
    } catch {}
    //    b) snake_case Tabelle aus Migration 0012 (nur per Raw SQL)
    try {
      await db.run(sql`
        DELETE FROM referral_invitations
        WHERE inviter_user_id = ${user.id}
           OR invited_email   = ${user.email ?? ""}
      `);
    } catch {}

    // 4) (Falls später Session-Tabelle vorhanden → hier löschen)
    // try { await db.run(sql`DELETE FROM session WHERE userId = ${user.id}`) } catch {}

    // 5) Den User zuletzt löschen
    await db.delete(userTable).where(eq(userTable.id, user.id));

    return { success: true as const };
  });
