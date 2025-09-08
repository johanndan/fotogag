// src/app/(settings)/settings/settings-page.tsx
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import ThemeCards from "@/components/theme-cards";

export default function SettingsExtraPage() {
  return (
    <div className="space-y-6">
      {/* THEME-Auswahl */}
      <Card id="theme">
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Wähle hell, dunkel oder Systemmodus.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeCards />
        </CardContent>
      </Card>
    </div>
  );
}
