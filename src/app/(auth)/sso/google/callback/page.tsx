// src/app/(auth)/sso/google/callback/page.tsx
import { redirect } from "next/navigation";

export default async function GoogleCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (Array.isArray(v)) v.forEach((x) => x != null && qs.append(k, String(x)));
    else if (v != null) qs.append(k, String(v));
  }

  // leitet intern an den Finalizer-Route-Handler weiter (kein Pfadwechsel nach außen)
  redirect(`/(auth)/sso/google/callback/finalize?${qs.toString()}`);
}
