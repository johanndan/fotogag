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
import { useRouter } from "next/navigation"
import { useSessionStore } from "@/state/session"
import { getInitials } from "@/utils/name-initials"
import type { Route } from "next"

const ROUTES = {
  root: "/" as const,
  settings: "/settings" as const,               // bleibt: Profil-Einstellungen
  settingsExtra: "/settings/settings" as const, // NEU: zusätzliche Settings-Seite
  update: "/dashboard/update" as const,
} satisfies Record<string, Route>

export function NavUser() {
  const { session, isLoading } = useSessionStore()
  const { signOut } = useSignOut()
  const { isMobile, setOpenMobile } = useSidebar()
  const router = useRouter()

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {/* Sidebar-Bereich mit Name, Email, Credits */}
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
                    setOpenMobile(false)
                    router.push(ROUTES.update)
                  }}
                >
                  {user.currentCredits} credits
                </Badge>
              </div>

              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          {/* Dropdown OHNE doppelte Benutzerinfos */}
          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              {/* Settings → Profil (mit Icon) */}
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  setOpenMobile(false)
                  router.push(ROUTES.settings)
                }}
              >
                <User />
                Profil
              </DropdownMenuItem>

              {/* NEU: zusätzlicher Menüpunkt 'Settings' darunter */}
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  setOpenMobile(false)
                  router.push(ROUTES.settingsExtra)
                }}
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
              onClick={() => {
                setOpenMobile(false)
                signOut().then(() => router.push(ROUTES.root))
              }}
              className="cursor-pointer"
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
