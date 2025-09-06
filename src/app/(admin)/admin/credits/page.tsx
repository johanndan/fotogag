// src/app/(admin)/admin/credits/page.tsx
import "server-only"

import { getDB } from "@/db"
import {
  creditTransactionTable,
  referralInvitationTable,
  appSettingTable,
  CREDIT_TRANSACTION_TYPE,
  REFERRAL_INVITATION_STATUS,
} from "@/db/schema"
import { and, eq, gte, sql } from "drizzle-orm"
import { saveDefaultAndReferral, saveConversion } from "./actions"

// UI
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

// ---------------- helpers ----------------
function windows() {
  const now = Date.now()
  return {
    d24h: new Date(now - 24 * 60 * 60 * 1000),
    d30d: new Date(now - 30 * 24 * 60 * 60 * 1000),
    d12m: new Date(now - 365 * 24 * 60 * 60 * 1000),
  }
}

async function getSetting(key: string) {
  const db = getDB()
  const row = await db.query.appSettingTable.findFirst({
    where: eq(appSettingTable.key, key),
    columns: { value: true },
  })
  return row?.value ?? ""
}

async function purchaseAgg(since: Date) {
  const db = getDB()
  const rows = await db
    .select({
      count: sql<number>`count(1)`,
      credits: sql<number>`coalesce(sum(${creditTransactionTable.amount}),0)`,
      cents: sql<number>`coalesce(sum(${creditTransactionTable.fiatAmountCents}),0)`,
    })
    .from(creditTransactionTable)
    .where(
      and(
        eq(creditTransactionTable.type, CREDIT_TRANSACTION_TYPE.PURCHASE),
        gte(creditTransactionTable.createdAt, since),
      ),
    )

  const r = rows[0] ?? { count: 0, credits: 0, cents: 0 }
  return { count: Number(r.count), credits: Number(r.credits), euros: Number(r.cents) / 100 }
}

async function inviteAgg(since: Date) {
  const db = getDB()
  const sent = await db
    .select({ c: sql<number>`count(1)` })
    .from(referralInvitationTable)
    .where(gte(referralInvitationTable.createdAt, since))

  const accepted = await db
    .select({ c: sql<number>`count(1)` })
    .from(referralInvitationTable)
    .where(
      and(
        gte(referralInvitationTable.createdAt, since),
        eq(referralInvitationTable.status, REFERRAL_INVITATION_STATUS.ACCEPTED),
      ),
    )

  return {
    sent: Number(sent[0]?.c ?? 0),
    accepted: Number(accepted[0]?.c ?? 0),
  }
}

// ---------------- page ----------------
export default async function CreditsPage() {
  const { d24h, d30d, d12m } = windows()

  const [p24h, p30d, p12m] = await Promise.all([
    purchaseAgg(d24h),
    purchaseAgg(d30d),
    purchaseAgg(d12m),
  ])
  const [i24h, i30d, i12m] = await Promise.all([
    inviteAgg(d24h),
    inviteAgg(d30d),
    inviteAgg(d12m),
  ])

  const [defaultReg, referralBonus, creditsPerEur] = await Promise.all([
    getSetting("default_registration_credits"),
    getSetting("referral_bonus_credits"),
    getSetting("credits_per_eur"),
  ])

  return (
    <div className="p-6 w-full min-w-0 flex flex-col overflow-hidden">
      {/* Header bleibt identisch */}
      <PageHeader
        items={[
          { href: "/admin", label: "Admin" },
          { href: "/admin/credits", label: "Credits" },
        ]}
      />

      <div className="mt-6 space-y-6">
        {/* Creditkäufe */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Creditkäufe</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatsBox title="Letzte 24 h" count={p24h.count} credits={p24h.credits} euros={p24h.euros} />
            <StatsBox title="Letzte 30 Tage" count={p30d.count} credits={p30d.credits} euros={p30d.euros} />
            <StatsBox title="Letzte 12 Monate" count={p12m.count} credits={p12m.credits} euros={p12m.euros} />
          </CardContent>
        </Card>

        {/* Einladungen */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Einladungen</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <InviteBox title="Letzte 24 h" sent={i24h.sent} accepted={i24h.accepted} />
            <InviteBox title="Letzte 30 Tage" sent={i30d.sent} accepted={i30d.accepted} />
            <InviteBox title="Letzte 12 Monate" sent={i12m.sent} accepted={i12m.accepted} />
          </CardContent>
        </Card>

        {/* Settings: Defaults */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Gratis Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveDefaultAndReferral} className="grid gap-4 max-w-xl">
              <div className="grid gap-2">
                <Label htmlFor="defaultRegistrationCredits">Credits bei Registrierung</Label>
                <Input
                  id="defaultRegistrationCredits"
                  name="defaultRegistrationCredits"
                  defaultValue={defaultReg}
                  inputMode="numeric"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="referralBonusCredits">Credits pro angenommener Einladung</Label>
                <Input
                  id="referralBonusCredits"
                  name="referralBonusCredits"
                  defaultValue={referralBonus}
                  inputMode="numeric"
                />
              </div>
              <Button type="submit" className="w-fit">Speichern</Button>
            </form>
          </CardContent>
        </Card>

        {/* Settings: Conversion */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Umrechnung Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveConversion} className="grid gap-4 max-w-xl">
              <div className="grid gap-2">
                <Label htmlFor="creditsPerEur">Credits pro 1&nbsp;EUR</Label>
                <Input
                  id="creditsPerEur"
                  name="creditsPerEur"
                  defaultValue={creditsPerEur}
                  inputMode="numeric"
                />
              </div>
              <Button type="submit" className="w-fit">Speichern</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* kleine Helfer – gleiche „Box“-Optik wie bei Users-Stats */
function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-sm text-muted-foreground mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}
function StatsBox({ title, count, credits, euros }:
  { title: string; count: number; credits: number; euros: number }) {
  return (
    <Box title={title}>
      <div className="text-xl font-semibold">{credits} Credits</div>
      <div className="text-xs text-muted-foreground">Käufe: {count}</div>
      <div className="text-xs text-muted-foreground">EUR: {euros.toFixed(2)}</div>
    </Box>
  )
}
function InviteBox({ title, sent, accepted }:
  { title: string; sent: number; accepted: number }) {
  return (
    <Box title={title}>
      <div className="text-xl font-semibold">{accepted} angenommen</div>
      <div className="text-xs text-muted-foreground">Gesendet: {sent}</div>
    </Box>
  )
}

export const dynamic = "force-dynamic"
