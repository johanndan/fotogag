"use server"
import "server-only"

import { getDB } from "@/db"
import { appSettingTable } from "@/db/schema"
import { sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

async function upsertSetting(key: string, value: string) {
  const db = getDB()
  await db.insert(appSettingTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettingTable.key,
      set: { value: sql`excluded.value`, updatedAt: new Date() },
    })
}

export async function saveDefaultAndReferral(formData: FormData) {
  await upsertSetting("default_registration_credits", String(formData.get("defaultRegistrationCredits") ?? "0"))
  await upsertSetting("referral_bonus_credits",       String(formData.get("referralBonusCredits") ?? "0"))
  revalidatePath("/admin/credits")        // <— invalidiert Cache/Route
  redirect("/admin/credits")              // <— forciert frisches Rendern
}

export async function saveConversion(formData: FormData) {
  await upsertSetting("credits_per_eur", String(formData.get("creditsPerEur") ?? "0"))
  revalidatePath("/admin/credits")
  redirect("/admin/credits")
}
