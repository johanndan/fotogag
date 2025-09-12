"use client";

import { ChevronLeft } from "lucide-react";
import { useSidebar } from "./sidebar-context";

/**
 * Immer sichtbar: fixiert am rechten Rand (mittig).
 * DaisyUI: btn + btn-circle + glass; silbriger Verlauf via .knob-silver (globals.css)
 * Richtungs-Hinweis: Icon zeigt die NÄCHSTE Aktion an (zu -> Öffnen = Pfeil nach links).
 */
export function SidebarKnob() {
  const { isOpen, toggle } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isOpen ? "Sidebar schließen" : "Sidebar öffnen"}
      aria-pressed={isOpen}
      className={[
        "fixed z-50",
        "top-1/2 right-[max(env(safe-area-inset-right),0.5rem)] -translate-y-1/2",
        "btn btn-circle glass knob-silver shadow-lg ring-1 ring-base-300/60",
        "backdrop-blur-sm select-none touch-manipulation",
        // Größen für gute Touch-Ziele (≥44px)
        "h-12 w-12 md:h-11 md:w-11",
        // Hover/Focus Styles ohne Farbwechsel
        "hover:shadow-xl focus:outline-none focus-visible:ring focus-visible:ring-base-300/70",
        // Richtungsvorschau (Wiggle)
        isOpen ? "knob-wiggle-right" : "knob-wiggle-left",
      ].join(" ")}
    >
      <ChevronLeft
        className={[
          "knob-icon h-5 w-5 transition-transform duration-300 ease-out",
          // Nächste Aktion anzeigen: offen = schließen = Pfeil nach rechts (180°)
          isOpen ? "rotate-180" : "rotate-0",
        ].join(" ")}
      />
      <span className="sr-only">{isOpen ? "Schließen" : "Öffnen"}</span>
    </button>
  );
}
