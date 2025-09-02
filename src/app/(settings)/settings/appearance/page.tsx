// src/app/settings/appearance/page.tsx
"use client";

import ThemeSwitch from "@/components/theme-switch";

export default function AppearanceSettingsPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Appearance</h1>
        <p className="text-sm text-muted-foreground">
          Wähle hell/dunkel oder Systemmodus.
        </p>
      </div>

      <div className="rounded-lg border p-4">
        <ThemeSwitch className="w-full">Change theme</ThemeSwitch>
      </div>
    </div>
  );
}
