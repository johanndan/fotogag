// src/app/(settings)/settings/settings-page.tsx
"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import ThemeCards from "@/components/theme-cards";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const SETTINGS_URL = "https://photogag.ai/dashboard" as const;

export default function SettingsExtraPage() {
  // Theme ist initial geöffnet
  const [value, setValue] = useState<string>("theme");

  const handleClose = () => {
    // direkt neu laden / navigieren
    window.location.assign(SETTINGS_URL);
  };

  return (
    <div className="space-y-6">
      <Accordion
        type="single"
        collapsible
        value={value}
        onValueChange={(v) => setValue(v || "")}
        className="w-full"
      >
        {/* Theme */}
        <AccordionItem value="theme">
          <AccordionTrigger className="text-left">Theme</AccordionTrigger>
          <AccordionContent>
            <Card id="theme">
              <CardHeader>
                <CardTitle>Theme</CardTitle>
                <CardDescription>Choose light, dark, or system mode.</CardDescription>
              </CardHeader>
              <CardContent>
                <ThemeCards />
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Language (Platzhalter) */}
        <AccordionItem value="language">
          <AccordionTrigger className="text-left">Language</AccordionTrigger>
          <AccordionContent>
            <Card id="language">
              <CardHeader>
                <CardTitle>Language</CardTitle>
                <CardDescription>App language settings (coming soon).</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  This section is a placeholder and will be expanded later.
                </p>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Close-Button mittig & fett */}
      <div className="mt-8 flex justify-center">
        <Button onClick={handleClose} className="font-bold">
          Close Menu
        </Button>
      </div>
    </div>
  );
}
