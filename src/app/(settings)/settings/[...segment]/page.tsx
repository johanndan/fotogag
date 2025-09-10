// /src/app/(settings)/settings/[...segment]/page.tsx
import "server-only";
import { redirect } from "next/navigation";

// Kein Rendern hier – wir leiten alles auf die kanonische Seite um.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SettingsCatchAll() {
  // z.B. /settings/foo/bar  -> /settings
  return redirect("/settings");
}
