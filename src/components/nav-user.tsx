"use client"

import { Bell, LogOut, ChevronsUpDown, Settings as SettingsIcon, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import useSignOut from "@/hooks/useSignOut"
import { useRouter, usePathname } from "next/navigation"
import { useSessionStore } from "@/state/session"
import { getInitials } from "@/utils/name-initials"
import type { Route } from "next"
import * as React from "react"

const ROUTES = {
  root: "/" as const,
  settings: "/settings" as const,
  settingsExtra: "/settings/settings" as const,
  update: "/dashboard/update" as const,
} satisfies Record<string, Route>

// 🔧 Safety helper: falls Radix/shadcn das am Body „vergisst“
function resetBodyPointerEvents() {
  try {
    if (document?.body?.style?.pointerEvents === "none") {
      document.body.style.pointerEvents = ""
    }
  } catch {}
}

export function NavUser() {
  const { session, isLoading } = useSessionStore()
  const { signOut } = useSignOut()
  const { isMobile, setOpenMobile } = useSidebar()
  const router = useRouter()
  const pathname = usePathname()

  // 👀 Wenn sich der Pfad ändert, sicherheitshalber Body entsperren
  React.useEffect(() => {
    resetBodyPointerEvents()
  }, [pathname])

  // Kontrolliertes Dropdown → wir können es garantiert schließen, bevor wir navigieren
  const [open, setOpen] = React.useState(false)

  // Einheitliche, sichere Navigation aus dem Dropdown
  const go = React.useCallback(
    (to: Route) => {
      // 1) Menü schließen & Mobile-Sidebar zu
      setOpen(false)
      setOpenMobile(false)
      // 2) Body-PE entsperren (falls gesetzt)
      resetBodyPointerEvents()
      // 3) NACH dem Close/Navigations-Start nochmals entsperren
      requestAnimationFrame(() => resetBodyPointerEvents())
      // 4) Navigieren
      router.push(to)
    },
    [router, setOpenMobile]
  )

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground h-14"
          >
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="grid flex-1 gap-0.5 text-left text-sm leading-tight">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-4 w-4 ml-auto" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!session?.user) return null

  const { user } = session
  const displayName =
    user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email ?? ""

  const initials =
    session.user.initials ??
    getInitials(`${user.firstName ?? ""} ${user.lastName ?? ""}`) ??
    (user.email ? user.email.slice(0, 2).toUpperCase() : "?")

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetBodyPointerEvents() }}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground h-14"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar ?? ""} alt={displayName} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>

              <div className="grid flex-1 gap-0.5 text-left text-sm leading-tight">
                <span className="font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                  {displayName}
                </span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>

                <Badge
                  variant="secondary"
                  className="w-fit text-[10px]"
                  onClick={(e) => {
                    e.preventDefault()
                    go(ROUTES.update)
                  }}
                >
                  {user.currentCredits} credits
                </Badge>
              </div>

              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
            // Beim automatischen Close Fokus zurück → Body entsperren
            onCloseAutoFocus={() => { resetBodyPointerEvents(); return undefined }}
          >
            <DropdownMenuGroup>
              {/* Profil */}
              <DropdownMenuItem
                className="cursor-pointer"
                // ⬇️ WICHTIG: onSelect statt onClick, preventDefault, dann go()
                onSelect={(e) => { e.preventDefault(); go(ROUTES.settings) }}
              >
                <User />
                Profil
              </DropdownMenuItem>

              {/* Settings (extra) */}
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={(e) => { e.preventDefault(); go(ROUTES.settingsExtra) }}
              >
                <SettingsIcon />
                Settings
              </DropdownMenuItem>

              <DropdownMenuItem className="cursor-pointer">
                <Bell />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={async (e) => {
                e.preventDefault()
                setOpen(false)
                setOpenMobile(false)
                resetBodyPointerEvents()
                await signOut()
                router.push(ROUTES.root)
              }}
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
