// src/components/theme-cards.tsx
"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ThemeValue = "light" | "dark" | "system";

type ThemeOption = {
  value: ThemeValue;
  label: string;
  Icon: LucideIcon; // ✅ statt React.ComponentType<any>
};

const OPTIONS: readonly ThemeOption[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

export default function ThemeCards({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [selected, setSelected] = React.useState<ThemeValue>("system");

  // Verhindert Hydration-Flicker
  React.useEffect(() => setMounted(true), []);

  // Übernehme aktives Theme in die UI, aber nur erlaubte Werte
  React.useEffect(() => {
    if (theme === "light" || theme === "dark" || theme === "system") {
      setSelected(theme);
    }
  }, [theme]);

  if (!mounted) {
    return <div className={cn("grid gap-4 sm:grid-cols-3", className)} aria-hidden />;
  }

  return (
    <div role="radiogroup" aria-label="Theme" className={cn("grid gap-4 sm:grid-cols-3", className)}>
      {OPTIONS.map(({ value, label, Icon }) => {
        const checked = selected === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => {
              setTheme(value);
              setSelected(value);
            }}
            className={cn(
              "rounded-lg border px-6 py-8 text-center transition hover:bg-muted/60",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              checked ? "bg-muted border-primary" : "bg-background"
            )}
            data-checked={checked ? "true" : "false"}
          >
            <Icon className="mx-auto mb-3 h-5 w-5" />
            <span className="text-sm font-medium">{label}</span>
            {value === "system" && (
              <span className="mt-1 block text-xs text-muted-foreground">
                ({resolvedTheme ?? "—"} via system)
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
