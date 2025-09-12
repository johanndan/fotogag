"use client";

import { useSidebar } from "./sidebar-context";
import { PropsWithChildren } from "react";

/**
 * Linke Sidebar-Hülle mit Breiten-Animation.
 * Auf Mobile (md<) wird die Sidebar überlagert (fixed) + Overlay-Klick schließt.
 */
export function Sidebar({ children }: PropsWithChildren) {
  const { isOpen, close } = useSidebar();

  return (
    <>
      {/* Overlay nur auf Mobile sichtbar, klick schließt */}
      <div
        aria-hidden
        onClick={close}
        className={[
          "md:hidden fixed inset-0 z-40 transition-opacity",
          isOpen ? "opacity-100 bg-black/30 backdrop-blur-[1px]" : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      <aside
        data-open={isOpen}
        className={[
          "relative z-40 md:z-auto",
          // Desktop: links im Flow; Mobile: Overlay
          "md:static fixed left-0 top-0 h-dvh",
          // DaisyUI neutrale Fläche
          "bg-base-100 border-r border-base-300",
          // Breite animieren
          "transition-[width] duration-200 ease-in-out",
          isOpen ? "w-64 md:w-64" : "w-0 md:w-14", // md:w-14 = Icon-Bar optional
          // Inhalt scrollen
          "overflow-hidden",
        ].join(" ")}
      >
        {/* Inhalt: bei zu (w-0) unsichtbar halten */}
        <div className={["h-full", isOpen ? "opacity-100" : "opacity-0 md:opacity-100"].join(" ")}>
          {children}
        </div>
      </aside>
    </>
  );
}
