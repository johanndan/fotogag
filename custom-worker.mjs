// custom-worker.mjs
import handler, { DOQueueHandler /* , DOShardedTagCache */ } from "./.open-next/worker.js";
export { DOQueueHandler /* , DOShardedTagCache */ };

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",

  // Scripts (Next / Stripe / Turnstile)
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://js.stripe.com https://m.stripe.network https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://js.stripe.com https://m.stripe.network https://challenges.cloudflare.com https://static.cloudflareinsights.com",

  // Styles
  "style-src 'self' 'unsafe-inline'",
  "style-src-elem 'self' 'unsafe-inline'",

  // Media / Fonts / Networking
  "img-src 'self' data: blob: https://*.stripe.com https://challenges.cloudflare.com",
  "font-src 'self' data:",
  "connect-src 'self' https: wss: https://api.stripe.com https://m.stripe.network https://js.stripe.com https://challenges.cloudflare.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://m.stripe.network https://pay.stripe.com https://challenges.cloudflare.com",
  "worker-src 'self' blob:",

  // Forms (Stripe)
  "form-action 'self' https://hooks.stripe.com https://pay.stripe.com",
].join("; ");

export default {
  async fetch(request, env, ctx) {
    const res = await handler.fetch(request, env, ctx);
    const headers = new Headers(res.headers);

    headers.delete("Content-Security-Policy");
    headers.delete("content-security-policy");
    headers.delete("Content-Security-Policy-Report-Only");
    headers.delete("content-security-policy-report-only");

    headers.set("Content-Security-Policy", CSP);
    headers.set("Permissions-Policy", [
      "geolocation=()", "camera=()", "microphone=()", "payment=()",
      "autoplay=()", "interest-cohort=()",
    ].join(", "));

    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};
