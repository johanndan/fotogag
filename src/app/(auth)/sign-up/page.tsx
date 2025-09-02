// src/app/(auth)/sign-up/page.tsx
import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { getSessionFromCookie } from "@/utils/auth";
import SignUpClientComponent from "./sign-up.client";
import { REDIRECT_AFTER_SIGN_IN } from "@/constants";

// ⬇️ Nur für Eingeladene: Client-Modal, das Name/Passwort abfragt.
// Das Modal zeigt sich NUR, wenn ?invited=1 in der URL steht.
import InviteSetupModal from "@/components/invite-setup-modal";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create a new account",
};

// Nur interne Pfade zulassen → verhindert Open-Redirects und erfüllt typedRoutes.
function toInternalRoute(path?: string, fallback: Route = "/"): Route {
  if (!path) return fallback;
  // intern: beginnt mit "/" (kein "//"), kein Schema wie "http://"
  if (path.startsWith("/") && !path.startsWith("//") && !path.includes("://")) {
    return path as Route;
  }
  return fallback;
}

const SignUpPage = async ({
  searchParams,
}: {
  // Next 15: searchParams kann (wie params) als Promise übergeben werden (Streaming).
  // Wir brauchen hier nur "redirect"; alles Einladungsbezogene liest das InviteSetupModal
  // clientseitig via useSearchParams.
  searchParams: Promise<{ redirect?: string }>;
}) => {
  const { redirect: redirectParam } = await searchParams;

  // Stelle sicher, dass der Default ein Route-Literal ist.
  const defaultRedirect = (REDIRECT_AFTER_SIGN_IN as unknown) as Route;
  const redirectPath = toInternalRoute(redirectParam, defaultRedirect);

  const session = await getSessionFromCookie();
  if (session) {
    return redirect(redirectPath);
  }

  return (
    <>
      <SignUpClientComponent redirectPath={redirectPath} />
      {/* Nur angezeigt, wenn ?invited=1 vorhanden ist (Logik im Client-Modal) */}
      <InviteSetupModal />
    </>
  );
};

export default SignUpPage;
