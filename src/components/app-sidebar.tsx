"use client";

import { type ComponentType } from "react";
import type { Route } from 'next';

// Import icons from lucide-react.  Teams and TeamSwitcher have been removed.
import {
  Frame,
  Map,
  PieChart,
  Settings2,
  ShoppingCart,
  SquareTerminal,
  CreditCard,
  Users,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useSessionStore } from "@/state/session";

/**
 * Defines the shape of a navigation item.  An optional `icon` can be
 * supplied to render an accompanying SVG.
 */
export type NavItem = {
  title: string;
  url: Route;
  icon?: ComponentType;
};

/**
 * Extends NavItem with optional active state and sub‑items for nested
 * navigation groups.
 */
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
  projects: NavItem[];
};

// TODO Add a theme switcher
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { session } = useSessionStore();

  // Build navigation menu.  The Teams menu and TeamSwitcher have been
  // removed.  Instead, provide an "Invite" entry pointing to the
  // referrals page where users can invite others and view their own invites.
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
          {
            title: "Profile",
            url: "/settings",
          },
          {
            title: "Security",
            url: "/settings/security",
          },
          {
            title: "Sessions",
            url: "/settings/sessions",
          },
          {
            title: "Change Password",
            url: "/forgot-password",
          },
        ],
      },
    ],
    projects: [
      {
        title: "Design Engineering",
        url: "#",
        icon: Frame,
      },
      {
        title: "Sales & Marketing",
        url: "#",
        icon: PieChart,
      },
      {
        title: "Travel",
        url: "#",
        icon: Map,
      },
    ],
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Removed TeamSwitcher and teams header because teams are no longer supported */}
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}