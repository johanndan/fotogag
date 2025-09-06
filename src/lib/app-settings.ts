import "server-only";
import { getDB } from "@/db";
import { appSettingTable } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Generischer Getter: liest einen String-Wert aus app_setting */
export async function getAppSetting(key: string): Promise<string> {
  const db = getDB();
  const row = await db.query.appSettingTable.findFirst({
    where: eq(appSettingTable.key, key),
    columns: { value: true },
  });
  return row?.value ?? "";
}

/** Komfort: Zahl aus app_setting lesen und robust in Number wandeln */
export async function getNumberSetting(key: string, fallback = 0): Promise<number> {
  const raw = await getAppSetting(key);
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Free Monthly Credits aus der DB.
 * Bevorzugt key "free_monthly_credits", fällt zurück auf "default_registration_credits".
 */
export async function getFreeMonthlyCredits(): Promise<number> {
  const explicit = await getNumberSetting("free_monthly_credits", NaN);
  if (Number.isFinite(explicit)) return explicit;
  return getNumberSetting("default_registration_credits", 0);
}

/** NEU: Bonus-Credits pro Einladung */
export async function getReferralBonusCredits(): Promise<number> {
  return getNumberSetting("referral_bonus_credits", 0);
}
