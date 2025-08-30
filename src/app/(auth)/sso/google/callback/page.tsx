import { redirect } from "next/navigation";
import type { Route } from "next";

export default async function GoogleCallbackPage({
  searchParams,
}: {
  // Next 15: kann als Promise gestreamt werden
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (Array.isArray(v)) v.forEach((x) => x != null && qs.append(k, String(x)));
    else if (v != null) qs.append(k, String(v));
  }

  // WICHTIG: Route-Groups nicht in die URL schreiben!
  const BASE: Route<"/sso/google/callback/finalize"> = "/sso/google/callback/finalize";

  const href =
    qs.size > 0
      ? (`/sso/google/callback/finalize?${qs.toString()}` as Route<
          `/sso/google/callback/finalize?${string}`
        >)
      : BASE;

  redirect(href);
}
