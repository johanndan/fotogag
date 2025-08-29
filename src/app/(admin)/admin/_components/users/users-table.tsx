"use client"

import { useEffect } from "react"
import { DataTable } from "@/components/data-table"
import { columns, type User } from "./columns"
import { getUsersAction } from "../../_actions/get-users.action"
import { useServerAction } from "zsa-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { PAGE_SIZE_OPTIONS } from "../../admin-constants"
import { useQueryState } from "nuqs"

import { getUsersStatsAction, type UsersStats } from "../../_actions/get-users-stats.action"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card" // ✨ neu

/* ---------- UI-Bausteine ---------- */

function PillList({ emails, max = 10 }: { emails: string[]; max?: number }) {
  const shown = emails.slice(0, max)
  const more = Math.max(0, emails.length - shown.length)
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((e, i) => (
        <Badge key={`${e}-${i}`} variant="secondary" className="font-normal">{e}</Badge>
      ))}
      {more > 0 && <Badge variant="outline" className="font-normal">+{more} more</Badge>}
    </div>
  )
}

function StatCard(props: { title: string; subtitle: string; count?: number; emails?: string[]; loading?: boolean }) {
  const { title, subtitle, count, emails = [], loading } = props
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-semibold">{loading ? "…" : (count ?? 0)}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
        {!loading && emails.length > 0 && <PillList emails={emails} />}
      </CardContent>
    </Card>
  )
}

function UsersStatsBar() {
  const { execute, data, isPending, isError, error } = useServerAction(getUsersStatsAction, {
    onError: () => toast.error("Failed to load user stats"),
  })
  useEffect(() => { void execute() }, [execute])

  const stats: UsersStats | undefined = data

  return (
    <div className="flex flex-col gap-4">
      {/* Sektion: Registriert */}
      <Card className="shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Registriert</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard title="Letzte 24 h" subtitle="Neue Accounts & Emails" loading={isPending} count={stats?.registered24h.count} emails={stats?.registered24h.emails} />
            <StatCard title="Letzte 30 Tage" subtitle="Neue Accounts & Emails" loading={isPending} count={stats?.registered30d.count} emails={stats?.registered30d.emails} />
            <StatCard title="Letzte 12 Monate" subtitle="Neue Accounts & Emails" loading={isPending} count={stats?.registered12m.count} emails={stats?.registered12m.emails} />
          </div>
          {isError && <div className="mt-2 text-xs text-destructive">Fehler beim Laden der Registrierungs-Statistiken{error?.message ? `: ${error.message}` : "."}</div>}
        </CardContent>
      </Card>

      {/* Sektion: Aktiv */}
      <Card className="shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Aktiv</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatCard title="Letzte 24 h" subtitle="Aktive User (Proxy: updatedAt)" loading={isPending} count={stats?.active24h.count} emails={stats?.active24h.emails} />
            <StatCard title="Letzte 30 Tage" subtitle="Aktive User (Proxy: updatedAt)" loading={isPending} count={stats?.active30d.count} emails={stats?.active30d.emails} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ---------- bestehende Tabelle ---------- */

export function UsersTable() {
  const [page, setPage] = useQueryState("page", { defaultValue: "1" })
  const [pageSize, setPageSize] = useQueryState("pageSize", { defaultValue: PAGE_SIZE_OPTIONS[0].toString() })
  const [emailFilter, setEmailFilter] = useQueryState("email", { defaultValue: "" })

  const { execute: fetchUsers, data, error, status } = useServerAction(getUsersAction, {
    onError: () => toast.error("Failed to fetch users"),
  })

  useEffect(() => {
    fetchUsers({ page: parseInt(page), pageSize: parseInt(pageSize), emailFilter })
  }, [fetchUsers, page, pageSize, emailFilter])

  const handlePageChange = (newPage: number) => setPage((newPage + 1).toString())
  const handlePageSizeChange = (newPageSize: number) => { setPageSize(newPageSize.toString()); setPage("1") }
  const handleEmailFilterChange = (value: string) => { setEmailFilter(value); setPage("1") }
  const getRowHref = (user: User) => `/admin/users/${user.id}`

  return (
    <div className="p-6 w-full min-w-0 flex flex-col overflow-hidden">
      <div className="flex flex-col gap-4 flex-shrink-0">
        <h1 className="text-3xl font-bold">Users</h1>

        {/* Stats im selben Look-and-Feel wie die restliche Seite */}
        <UsersStatsBar />

        {/* Filterzeile darunter, rechtsbündig (unverändert) */}
        <div className="flex justify-start sm:justify-end">
          <Input
            placeholder="Filter emails..."
            type="search"
            value={emailFilter}
            onChange={(e) => handleEmailFilterChange(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </div>

      <div className="mt-8 flex-1 min-h-0">
        <div className="space-y-4 h-full">
          {status === "pending" || status === "idle" ? (
            <div>Loading...</div>
          ) : error ? (
            <div>Error: Failed to fetch users</div>
          ) : !data ? (
            <div>No users found</div>
          ) : (
            <div className="w-full min-w-0">
              <DataTable
                columns={columns}
                data={data.users}
                pageCount={data.totalPages}
                pageIndex={parseInt(page) - 1}
                pageSize={parseInt(pageSize)}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                totalCount={data.totalCount}
                itemNameSingular="user"
                itemNamePlural="users"
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                getRowHref={getRowHref}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
