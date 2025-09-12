"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { Route } from "next";
import {
  ShoppingCart,
  SquareTerminal,
  CreditCard,
  ChevronsLeft, // Doppel-Pfeil
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useSessionStore } from "@/state/session";
import { cn } from "@/lib/utils";

/** Gemeinsamer Typ für Nav-Items (Icon optional) */
export type NavItem = { title: string; url: Route; icon?: ComponentType };
export type NavMainItem = NavItem & { isActive?: boolean; items?: NavItem[] };

type Data = {
  user: { name: string; email: string };
  navMain: NavMainItem[];
};

/* -------------------- Docked-Knubbel (in der Sidebar) -------------------- */
function DockedSidebarKnob() {
  const { isMobile, openMobile, setOpenMobile, toggleSidebar, state } = useSidebar();

  // Wir rendern den Knubbel nur nach Mount (AppSidebar gated already, hier optional)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isOpenNow = isMobile ? openMobile : state === "expanded";

  // Mobile & zu => Docked unsichtbar (Sidebar off-canvas)
  if (isMobile && !openMobile) return null;

  // Offen = +10 px weiter draußen; Zu = 50% sichtbar (w-24=96px → 48px)
  const x = isOpenNow ? 30 : 30; // Pixel

  return (
    // Anchor: füllt die Sidebar-Höhe → Knubbel garantiert mittig
    <div className="pointer-events-none absolute inset-y-0 right-0 z-[20] grid place-items-center">
      <button
        type="button"
        aria-label={isOpenNow ? "Sidebar schließen" : "Sidebar öffnen"}
        aria-pressed={isOpenNow}
        onClick={() => (isMobile ? setOpenMobile(!openMobile) : toggleSidebar())}
        // Horizontaler Überstand als Translation (animiert)
        style={{ transform: `translateX(${x}px)` }}
        className={cn(
          "pointer-events-auto select-none transition-transform duration-300 ease-out",
          // native Button-Ränder/Look aus
          "appearance-none ring-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sidebar-ring)]",
          // 200% Größe, Pfeile rechts
          "min-h-0 h-20 w-24 px-4 pr-3 flex items-center justify-end",  // Knubbellänge
          // Verschmelzen: gleiche Farbe; Naht kaschieren; NUR rechts Linie/Schatten
          "relative knob-merge knob-fuse knob-hide-seam knob-shadow-right"
        )}
      >
        {/* offen = ← (0°), zu = → (180°) */}
        <ChevronsLeft className={cn("h-6 w-6", isOpenNow ? "rotate-0" : "rotate-180")} />
        <span className="sr-only">{isOpenNow ? "Schließen" : "Öffnen"}</span>
      </button>
    </div>
  );
}

/* --------- Fallback-Knubbel (außerhalb, nur Mobile & zu, 200% groß) -------- */
function MobileEdgeKnob() {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  if (!isMobile || openMobile) return null;

  // 50% sichtbar am linken Rand: w-24 = 96px -> -48px
  return (
    <button
      type="button"
      aria-label="Sidebar öffnen"
      onClick={() => setOpenMobile(true)}
      className={cn(
        "fixed top-1/2 -translate-y-1/2 z-[60]",
        "left-[calc(max(env(safe-area-inset-left),0px)-48px)]",
        "min-h-0 h-20 w-24 px-4 pr-3 flex items-center justify-end",
        "border knob-merge knob-fuse"
      )}
    >
      <ChevronsLeft className="h-6 w-6 rotate-180" />
      <span className="sr-only">Öffnen</span>
    </button>
  );
}

type SidebarProps = React.ComponentProps<typeof Sidebar>;

export function AppSidebar(props: SidebarProps) {
  const { className, ...rest } = props;
  const { session } = useSessionStore();

  // GANZE Sidebar erst nach Mount → vermeidet SSR/CSR-Abweichungen (#418)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const navMain = [
    { title: "Home", url: "/dashboard", icon: SquareTerminal, isActive: true },
    { title: "Marketplace", url: "/dashboard/marketplace", icon: ShoppingCart },
    { title: "Update", url: "/dashboard/update" as Route, icon: CreditCard },
  ] satisfies NavMainItem[];

  const data: Data = {
    user: {
      name:  session?.user?.firstName || "User",
      email: session?.user?.email     || "user@example.com",
    },
    navMain,
  };

  // SSR/Initial-CSR: Platzhalter (Icon-Breite), damit Layout stabil bleibt
  if (!mounted) {
    return (
      <aside
        data-ssr-sidebar-placeholder
        className="sticky top-0 self-start h-dvh w-[var(--sidebar-width-icon,56px)]"
      />
    );
  }

  return (
    <>
      {/* sticky top-0 + h-dvh: Sidebar startet oben und bleibt sichtbar */}
      <Sidebar
        collapsible="icon"
        {...rest}
        className={cn(
          "sticky top-0 self-start h-dvh overflow-visible isolate z-[20]",
          className
        )}
      >
        <SidebarContent className="h-full overflow-y-auto">
          <NavMain items={data.navMain} />
        </SidebarContent>

        <SidebarFooter>
          <div className="w-full space-y-2">
            <NavUser />
          </div>
        </SidebarFooter>

        {/* Rail eine Stufe darunter lassen (z-19), damit Knubbel nicht verdeckt wird */}
        <SidebarRail className="z-[19]" />

        {/* Angedockter, verschmolzener Knubbel */}
        <DockedSidebarKnob />
      </Sidebar>

      {/* Fallback-Knubbel für Mobile, wenn zu */}
      <MobileEdgeKnob />
    </>
  );
}
