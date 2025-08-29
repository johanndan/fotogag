"use server"

import { createServerAction } from "zsa"
import { z } from "zod"
import { getDB } from "@/db"
import { userTable } from "@/db/schema"
import { and, gte, isNotNull, sql } from "drizzle-orm"

// NICHT exportieren (sonst weiterer Laufzeit-Export!)
const UsersStatsSchema = z.object({
  registered24h: z.object({ count: z.number(), emails: z.array(z.string()) }),
  registered30d: z.object({ count: z.number(), emails: z.array(z.string()) }),
  registered12m: z.object({ count: z.number(), emails: z.array(z.string()) }),
  active24h:     z.object({ count: z.number(), emails: z.array(z.string()) }),
  active30d:     z.object({ count: z.number(), emails: z.array(z.string()) }),
})

// Typ-Export ist okay (nur zur Compile-Zeit vorhanden)
export type UsersStats = z.infer<typeof UsersStatsSchema>

export const getUsersStatsAction = createServerAction()
  .output(UsersStatsSchema)
  .handler(async () => {
    const db = getDB()
    const now = Date.now()
    const d24h = new Date(now - 24 * 60 * 60 * 1000)
    const d30d = new Date(now - 30 * 24 * 60 * 60 * 1000)
    const d12m = new Date(now - 365 * 24 * 60 * 60 * 1000)

    async function countAndEmailsSince(ts: Date, field: "createdAt" | "updatedAt") {
      const [{ c }] = await db
        .select({ c: sql<number>`count(1)` })
        .from(userTable)
        .where(gte(userTable[field], ts))

      const rows = await db
        .select({ email: userTable.email })
        .from(userTable)
        .where(and(gte(userTable[field], ts), isNotNull(userTable.email)))
        .orderBy(userTable.createdAt)
        .limit(20)

      return { count: Number(c ?? 0), emails: rows.map(r => r.email!).filter(Boolean) }
    }

    const [r24, r30, r12, a24, a30] = await Promise.all([
      countAndEmailsSince(d24h, "createdAt"),
      countAndEmailsSince(d30d, "createdAt"),
      countAndEmailsSince(d12m, "createdAt"),
      countAndEmailsSince(d24h, "updatedAt"),
      countAndEmailsSince(d30d, "updatedAt"),
    ])

    return {
      registered24h: r24,
      registered30d: r30,
      registered12m: r12,
      active24h: a24,
      active30d: a30,
    }
  })
