// src/components/app-sidebar.tsx
"use client";

import { type ComponentType } from "react";
import type { Route } from "next";
import {
  Settings2,
  ShoppingCart,
  SquareTerminal,
  CreditCard,
  Lock,
  Smartphone,
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

  // Unterpunkte für "Settings" – mit Icons
  const settingsItems = [
    { title: "Biometric login", url: "/settings/security", icon: Lock },
    { title: "Sessions", url: "/settings/sessions", icon: Smartphone },
  ] satisfies NavItem[];

  // Hauptnavigation ohne `as Route`-Assertions
  const navMain = [
    {
      title: "Home",
      url: "/dashboard",
      icon: SquareTerminal,
      isActive: true,
    },
    {
      title: "Marketplace",
      url: "/dashboard/marketplace",
      icon: ShoppingCart,
    },
    {
      title: "Update",
      url: "/dashboard/update" as Route,
      icon: CreditCard,
    },
    {
      title: "In work",
      url: "/settings",
      icon: Settings2,
      items: settingsItems,
    },
  ] satisfies NavMainItem[];

  const data: Data = {
    user: {
      name: session?.user?.firstName || "User",
      email: session?.user?.email || "user@example.com",
    },
    navMain,
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>

      <SidebarFooter>
        <div className="w-full space-y-2">
          <NavUser />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
