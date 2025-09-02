// src/components/app-sidebar.tsx
"use client";

import { type ComponentType } from "react";
import type { Route } from "next";

import {
  Settings2,
  ShoppingCart,
  SquareTerminal,
  CreditCard,
  Users,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useSessionStore } from "@/state/session";

/** Gemeinsamer Typ für Nav-Items (Icon optional) */
export type NavItem = {
  title: string;
  url: Route;
  icon?: ComponentType;
};

export type NavMainItem = NavItem & {
  isActive?: boolean;
  items?: NavItem[];
};

type Data = {
  user: {
    name: string;
    email: string;
  };
  navMain: NavMainItem[];
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { session } = useSessionStore();

  const data: Data = {
    user: {
      name: session?.user?.firstName || "User",
      email: session?.user?.email || "user@example.com",
    },
    navMain: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: SquareTerminal,
        isActive: true,
      },
      {
        title: "Invite",
        url: "/dashboard/invite" as Route,
        icon: Users,
      },
      {
        title: "Update",
        url: "/dashboard/marketplace",
        icon: ShoppingCart,
      },
      {
        title: "Billing",
        url: "/dashboard/billing",
        icon: CreditCard,
      },
      {
        title: "Settings",
        url: "/settings",
        icon: Settings2,
        items: [
          { title: "Profile", url: "/settings" as Route },
          { title: "Security", url: "/settings/security" as Route },
          { title: "Sessions", url: "/settings/sessions" as Route },
          { title: "Change Password", url: "/forgot-password" as Route },
          // ⬇️ neu: ganz unten als letzter Menüpunkt
          { title: "Change Theme", url: "/settings/appearance" as Route },
        ],
      },
    ],
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
