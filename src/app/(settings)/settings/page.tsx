// /src/app/(settings)/settings/page.tsx
import "server-only";
import { unstable_noStore as noStore } from "next/cache";
import { getSessionFromCookie } from "@/utils/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SettingsForm } from "./settings-form";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { getDB } from "@/db";
import { passKeyCredentialTable } from "@/db/schema";
import type { PassKeyCredential } from "@/db/schema";
import type { ParsedUserAgent } from "@/types";
import { eq } from "drizzle-orm";
import { UAParser } from "ua-parser-js";

// immer dynamisch & ohne Cache ausliefern
export const dynamic = "force-dynamic";
export const revalidate = 0;

function SettingsFormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="space-y-2">
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-4 w-[300px]" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-[200px]" />
          </div>

          <div className="flex justify-end">
            <Skeleton className="h-10 w-[100px]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ParsedPasskey extends Omit<PassKeyCredential, "userAgent"> {
  userAgent: string | null;
  parsedUserAgent: ParsedUserAgent;
}

export default async function SettingsPage() {
  noStore(); // kein Full-Route-/Data-Cache für diesen Render

  const session = await getSessionFromCookie();
  if (!session) return redirect("/sign-in");

  // Passkeys für den eingeloggten User laden
  const db = getDB();
  const passkeys = await db
    .select()
    .from(passKeyCredentialTable)
    .where(eq(passKeyCredentialTable.userId, session.user.id));

  // User-Agent je Passkey für die Anzeige parsen
  const passkeysWithParsedUA: ParsedPasskey[] = passkeys.map((pk) => {
    const ua = pk.userAgent ?? null;
    const res = new UAParser(ua ?? "").getResult();
    return {
      ...pk,
      userAgent: ua,
      parsedUserAgent: {
        ua: ua ?? "",
        browser: { name: res.browser.name, version: res.browser.version, major: res.browser.major },
        device: { model: res.device.model, type: res.device.type, vendor: res.device.vendor },
        engine: { name: res.engine.name, version: res.engine.version },
        os: { name: res.os.name, version: res.os.version },
      },
    };
  });

  return (
    <Suspense fallback={<SettingsFormSkeleton />}>
      <SettingsForm
        passkeys={passkeysWithParsedUA}
        currentPasskeyId={session.passkeyCredentialId ?? null}
        email={session.user.email}
      />
    </Suspense>
  );
}
