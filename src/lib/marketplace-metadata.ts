// Metadata for marketplace components used in both client and server environments.
// This file defines the static information about each component (id, name,
// description, credit cost and optional container class). Client-only files
// should import this metadata and augment it with render functions.

export interface ComponentMetadata {
  id: string;
  name: string;
  description: string;
  credits: number;
  containerClass?: string;
}

export const COMPONENT_METADATA: ComponentMetadata[] = [
  {
    id: "theme-switch",
    name: "AI Photo Restoration",
    description:
      "Bring old or damaged photos back to life. Repair scratches, revive colors, and sharpen faces in one credit-powered pass.",
    credits: 0.5,
  },
  {
    id: "separator-with-text",
    name: "Magic Effects & Styles",
    description:
      "Give any shot a wow-factor with cinematic filters and artistic styles. One click, stunning transformations—paid with credits only when you run it.",
    credits: 2,
    containerClass: "w-full",
  },
  {
    id: "nav-user",
    name: "Age Transformation",
    description:
      "See yourself younger, older, or anywhere in between. Fun, shareable results—each transformation uses credits, no subscription needed.",
    credits: 5,
    containerClass: "w-[300px]",
  },
  {
    id: "page-header",
    name: "Smart Object Removal",
    description:
      "Erase photobombers, clutter, or backgrounds in seconds with AI fill. Clean, professional results whenever you spend credits.",
    credits: 10,
    containerClass: "w-full",
  },
  {
    id: "button",
    name: "Batch Enhancements",
    description:
      "Fix lighting, color, and clarity across many photos at once. Perfect for albums—credits are only used when you process.",
    credits: 15,
    containerClass: "w-full flex justify-center",
  },
];
