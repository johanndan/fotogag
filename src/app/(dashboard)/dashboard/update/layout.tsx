// Server Component
import { headers } from "next/headers";
import Script from "next/script";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      {/* Stripe v3 früh & mit Nonce laden */}
      <Script src="https://js.stripe.com/v3" strategy="beforeInteractive" nonce={nonce} />
      {children}
    </>
  );
}
