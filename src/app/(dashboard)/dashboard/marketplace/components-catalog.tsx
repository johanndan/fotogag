"use client";

import { type ReactNode } from "react";
import ThemeSwitch from "@/components/theme-switch";
import SeparatorWithText from "@/components/separator-with-text";
import { NavUser } from "@/components/nav-user";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

// Import shared metadata used by the server. We extend it here with preview
// functions that can only run on the client. Keeping the metadata in a
// separate module allows server components (such as the marketplace page and
// purchase action) to consume component information without importing
// client‑only modules. See components-metadata.ts for the shape of each
// entry.
import { COMPONENT_METADATA } from "@/lib/marketplace-metadata";

// Define the shape of a marketplace component card. Each entry includes
// metadata about the component along with a preview render function.
interface MarketplaceComponent {
  id: string;
  name: string;
  description: string;
  credits: number;
  containerClass?: string;
  preview: () => ReactNode;
}

/**
 * Components available in the marketplace.
 *
 * The team switcher component has been removed because the application
 * no longer supports teams. Feel free to add additional components here
 * in the future. Each entry should provide an `id`, `name`, `description`,
 * `credits` cost and a `preview` function that renders the component.
 */
// Build the full list of components by combining the shared metadata with
// client‑side preview functions. Each entry in COMPONENT_METADATA defines the
// id, name, description, credits and optional containerClass. Here we attach
// a preview function that returns the appropriate React node for each id.
export const COMPONENTS: MarketplaceComponent[] = COMPONENT_METADATA.map((meta) => {
  switch (meta.id) {
    case "theme-switch":
      return {
        ...meta,
        preview: () => <ThemeSwitch />, 
      };
    case "separator-with-text":
      return {
        ...meta,
        preview: () => (
          <SeparatorWithText>
            <span className="text-muted-foreground">OR</span>
          </SeparatorWithText>
        ),
      };
    case "nav-user":
      return {
        ...meta,
        preview: () => <NavUser />, 
      };
    case "page-header":
      return {
        ...meta,
        preview: () => (
          <PageHeader
            items={[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/dashboard/settings", label: "Settings" },
            ]}
          />
        ),
      };
    case "button":
      return {
        ...meta,
        preview: () => <Button>Click me</Button>, 
      };
    default:
      // Fallback: return metadata without preview to avoid runtime errors.
      return {
        ...meta,
        preview: () => null,
      };
  }
});