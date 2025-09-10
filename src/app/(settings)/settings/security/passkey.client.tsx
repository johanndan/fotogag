// /src/app/(settings)/settings/security/passkey.client.tsx
"use client";

import { useState, useRef } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import {
  generateRegistrationOptionsAction,
  verifyRegistrationAction,
  deletePasskeyAction,
} from "./passkey-settings.actions";

import { PASSKEY_AUTHENTICATOR_IDS } from "@/utils/passkey-authenticator-ids";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { ParsedUserAgent } from "@/types";
import { useSessionStore } from "@/state/session";

/* --------------------------------- Const --------------------------------- */
const SIGNIN_URL = "https://photogag.ai/";

/* ------------------------------ Small helpers ---------------------------- */
async function doLogout(): Promise<void> {
  try {
    const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    if (!res.ok) {
      await fetch("/api/auth/logout", { method: "GET", credentials: "include" });
    }
  } catch {
    // ignore – we redirect anyway
  }
}

/* -------------------------------------------------------------------------- */
/*                              Register-Button                               */
/* -------------------------------------------------------------------------- */
interface PasskeyRegistrationButtonProps {
  email: string;
  className?: string;
  onSuccess?: () => void;
}

function PasskeyRegistrationButton({
  email,
  className,
  onSuccess,
}: PasskeyRegistrationButtonProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const router = useRouter();

  const handleRegister = async () => {
    try {
      setIsRegistering(true);

      // 1) Optionen vom Server holen (ZSA)
      const [options] = await generateRegistrationOptionsAction({ email });
      if (!options) throw new Error("Failed to get registration options");

      // 2) Browser-Flow starten
      const response = await startRegistration({ optionsJSON: options });

      // 3) Server-seitig verifizieren (ZSA)
      await verifyRegistrationAction({
        email,
        response,
        challenge: options.challenge,
      });

      toast.success("Biometric registered successfully");
      onSuccess?.();
      router.refresh();
    } catch (err) {
      console.error("Biometric registration error:", err);
      toast.error("Failed to register biometric");
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <Button
      onClick={handleRegister}
      disabled={isRegistering}
      className={cn(className)}
    >
      {isRegistering ? "Registering..." : "Register Biometric"}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/*                             Liste der Passkeys                              */
/* -------------------------------------------------------------------------- */
interface Passkey {
  id: string;
  credentialId: string;
  userId: string;
  createdAt: Date;
  aaguid: string | null;
  userAgent: string | null;
  parsedUserAgent?: ParsedUserAgent;
}

interface PasskeysListProps {
  passkeys: Passkey[];
  /** Die credentialId des aktuell verwendeten Passkeys, wenn per Biometric eingeloggt */
  currentPasskeyId: string | null;
  email: string | null;
}

export function PasskeysList({ passkeys, currentPasskeyId, email }: PasskeysListProps) {
  const router = useRouter();
  const dialogCloseRef = useRef<HTMLButtonElement>(null);
  const { session } = useSessionStore();

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { execute: deletePasskey } = useServerAction(deletePasskeyAction, {
    onSuccess: () => {
      toast.success("Biometric deleted");
      dialogCloseRef.current?.click();
      router.refresh();
    },
  });

  const isCurrentPasskey = (p: Passkey) => p.credentialId === currentPasskeyId;
  const isBiometricAuth = session?.authenticationType === "passkey";

  /** Haupt-Handler: conditionale Löschlogik */
  const handleDeleteBiometric = async (p: Passkey) => {
    try {
      setDeletingId(p.id);

      // Fall A: User ist via Biometric eingeloggt und löscht genau dieses Biometric
      if (isBiometricAuth && isCurrentPasskey(p)) {
        // 1) Biometric löschen (solange Session noch gültig ist)
        await deletePasskey({ credentialId: p.credentialId });

        // 2) Logout (Cookies serverseitig weg)
        await doLogout();

        // 3) Hard-Redirect: Startseite (kein "Zurück" zur geschützten Seite)
        window.location.replace(SIGNIN_URL); // ersetzt History-Eintrag. MDN bestätigt das Verhalten.
        // eslint-disable-next-line no-useless-return
        return;
      }

      // Fall B: User ist NICHT via Biometric eingeloggt -> direkt löschen
      await deletePasskey({ credentialId: p.credentialId });
      // Dialog schließt sich via onSuccess, UI wird dort refreshed
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete biometric");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Button links + Trennlinie darunter */}
      <div className="space-y-4">
        {email && (
          <div className="flex justify-start">
            <PasskeyRegistrationButton email={email} className="w-full sm:w-auto" />
          </div>
        )}
        <hr className="border-border" />
      </div>

      {/* Überschrift wie auf der Seite */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Biometrics</h2>
          <p className="text-sm text-muted-foreground">
            Manage your biometrics for passwordless authentication.
          </p>
        </div>
      </div>

      {/* Einträge */}
      <div className="space-y-4">
        {passkeys.map((passkey) => {
          const current = isCurrentPasskey(passkey);
          const showLogoutNotice = isBiometricAuth && current;

          return (
            <Card
              key={passkey.id}
              className={cn(
                !current ? "bg-card/40" : "border-3 border-primary/20 shadow-lg bg-secondary/30"
              )}
            >
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Linke Seite: Infos */}
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        {(passkey.aaguid &&
                          (PASSKEY_AUTHENTICATOR_IDS as Record<string, string>)[passkey.aaguid]) ||
                          "Unknown Authenticator App"}
                        {current && <Badge>Current Biometric</Badge>}
                      </CardTitle>
                      <div className="text-sm text-muted-foreground whitespace-nowrap">
                        · {formatDistanceToNow(passkey.createdAt)} ago
                      </div>
                    </div>

                    {passkey.parsedUserAgent && (
                      <CardDescription className="text-sm">
                        {passkey.parsedUserAgent.browser.name ?? "Unknown browser"}{" "}
                        {passkey.parsedUserAgent.browser.major ?? "Unknown version"} on{" "}
                        {passkey.parsedUserAgent.device.vendor ?? "Unknown device"}{" "}
                        {passkey.parsedUserAgent.device.model ?? "Unknown model"}{" "}
                        {passkey.parsedUserAgent.device.type ?? "Unknown type"} (
                        {passkey.parsedUserAgent.os.name ?? "Unknown OS"}{" "}
                        {passkey.parsedUserAgent.os.version ?? "Unknown version"})
                      </CardDescription>
                    )}
                  </div>

                  {/* Rechte Seite: roter Delete-Button */}
                  <div className="sm:pt-1">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full sm:w-auto"
                          title="Delete this biometric"
                          disabled={deletingId === passkey.id}
                        >
                          {deletingId === passkey.id ? "Deleting…" : "Delete biometric"}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete biometric?</DialogTitle>
                          <DialogDescription>
                            {showLogoutNotice
                              ? "You are currently signed in with this biometric. We'll sign you out and redirect you to the homepage, then remove this biometric. This action cannot be undone."
                              : "This will remove this biometric from your account. This action cannot be undone."}
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="mt-6 sm:mt-0">
                          <DialogClose ref={dialogCloseRef} asChild>
                            <Button variant="outline" disabled={deletingId === passkey.id}>
                              Cancel
                            </Button>
                          </DialogClose>
                          <Button
                            variant="destructive"
                            className="mb-4 sm:mb-0"
                            onClick={() => handleDeleteBiometric(passkey)}
                            disabled={deletingId === passkey.id}
                          >
                            {deletingId === passkey.id ? "Deleting…" : "Delete biometric"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}

        {passkeys.length === 0 && (
          <div className="text-center text-muted-foreground">
            No biometrics found. Add a biometric to enable passwordless authentication.
          </div>
        )}
      </div>
    </div>
  );
}
