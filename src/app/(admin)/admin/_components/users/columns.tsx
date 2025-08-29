"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type User = {
  id: string
  email: string | null
  name: string | null
  role: string
  status: "active" | "inactive"
  createdAt: Date
}

/* ===========================
   NEU: kompakte Stats-Bar
   =========================== */

export type UsersStats = {
  // Registrierungen
  registered24h: { count: number; emails: string[] }
  registered30d: { count: number; emails: string[] }
  registered12m: { count: number; emails: string[] }
  // Aktivität (Login/Benutzung) – Proxy: updatedAt
  active24h: { count: number; emails: string[] }
  active30d: { count: number; emails: string[] }
}

function PillList({ emails, max = 10 }: { emails: string[]; max?: number }) {
  const shown = emails.slice(0, max)
  const more = Math.max(0, emails.length - shown.length)
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((e, i) => (
        <Badge key={`${e}-${i}`} variant="secondary" className="font-normal">
          {e}
        </Badge>
      ))}
      {more > 0 && (
        <Badge variant="outline" className="font-normal">+{more} more</Badge>
      )}
    </div>
  )
}

function StatCard({
  title,
  subtitle,
  count,
  emails,
}: {
  title: string
  subtitle: string
  count: number
  emails: string[]
}) {
  return (
    <div className="rounded-2xl border p-4 space-y-2">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="text-lg font-semibold">{count}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
      {emails.length > 0 && <PillList emails={emails} />}
    </div>
  )
}

/**
 * Exportierte Client-Komponente: direkt unter "Users"
 * und über der Filter-Leiste rendern.
 */
export function UsersStatsBar({ stats }: { stats: UsersStats }) {
  return (
    <div className="mt-2 mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Registriert */}
      <div className="rounded-2xl border p-4">
        <div className="text-sm font-medium mb-3">Registriert</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            title="Letzte 24 h"
            subtitle="Neue Accounts & Emails"
            count={stats.registered24h.count}
            emails={stats.registered24h.emails}
          />
          <StatCard
            title="Letzte 30 Tage"
            subtitle="Neue Accounts & Emails"
            count={stats.registered30d.count}
            emails={stats.registered30d.emails}
          />
          <StatCard
            title="Letzte 12 Monate"
            subtitle="Neue Accounts & Emails"
            count={stats.registered12m.count}
            emails={stats.registered12m.emails}
          />
        </div>
      </div>

      {/* Aktiv */}
      <div className="rounded-2xl border p-4">
        <div className="text-sm font-medium mb-3">Aktiv</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StatCard
            title="Letzte 24 h"
            subtitle="Aktive User (Proxy: updatedAt)"
            count={stats.active24h.count}
            emails={stats.active24h.emails}
          />
          <StatCard
            title="Letzte 30 Tage"
            subtitle="Aktive User (Proxy: updatedAt)"
            count={stats.active30d.count}
            emails={stats.active30d.emails}
          />
        </div>
      </div>
    </div>
  )
}

/* ===========================
   Bestehende Tabelle
   =========================== */

export const columns: ColumnDef<User>[] = [
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.getValue("role") as string
      return (
        <Badge variant={role === "admin" ? "default" : "secondary"}>
          {role}
        </Badge>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge variant={status === "active" ? "default" : "destructive"}>
          {status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => {
      const date = row.getValue("createdAt") as Date
      const formattedDate = format(new Date(date), "PPpp")
      return (
        <Tooltip>
          <TooltipTrigger>
            {formatDistanceToNow(new Date(date), { addSuffix: true })}
          </TooltipTrigger>
          <TooltipContent>
            <p>{formattedDate}</p>
          </TooltipContent>
        </Tooltip>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const user = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(user.id)}
            >
              Copy user ID
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(user.email || "")}
            >
              Copy email
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
