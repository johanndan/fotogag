import type { Metadata, Route } from "next";
import { getSessionFromCookie } from "@/utils/auth";
import { redirect } from "next/navigation";
import SignInClientPage from "./sign-in.client";
import { REDIRECT_AFTER_SIGN_IN } from "@/constants";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your account",
};

// Hilfsfunktion: Nur interne Pfade zulassen (verhindert Open-Redirects)
function toInternalRoute(path?: string, fallback: Route = "/"): Route {
  if (!path) return fallback;
  // interne Route: beginnt mit genau einem "/" (kein "//"), kein Schema
  if (path.startsWith("/") && !path.startsWith("//") && !path.includes("://")) {
    return path as Route;
  }
  return fallback;
}

const SignInPage = async ({
  searchParams,
}: {
  // Next 15.5: searchParams als Promise (Streaming)
  searchParams: Promise<{ redirect?: string }>;
}) => {
  const { redirect: redirectParam } = await searchParams;

  // Stelle sicher, dass dein Default-Redirect ein Route-Literal ist (siehe Hinweis unten)
  const defaultRedirect = (REDIRECT_AFTER_SIGN_IN as unknown) as Route;
  const redirectPath = toInternalRoute(redirectParam, defaultRedirect);

  const session = await getSessionFromCookie();

  if (session) {
    // typedRoutes verlangt Route – wir geben nur geprüfte interne Pfade weiter
    return redirect(redirectPath);
  }

  return <SignInClientPage redirectPath={redirectPath} />;
};

export default SignInPage;
