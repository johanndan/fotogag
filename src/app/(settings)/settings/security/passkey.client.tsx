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
      className={cn("bg-black text-white hover:bg-black/90", className)}
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
  currentPasskeyId: string | null;
  email: string | null;
}

export function PasskeysList({ passkeys, currentPasskeyId, email }: PasskeysListProps) {
  const router = useRouter();
  const dialogCloseRef = useRef<HTMLButtonElement>(null);

  const { execute: deletePasskey } = useServerAction(deletePasskeyAction, {
    onSuccess: () => {
      toast.success("Biometric deleted");
      dialogCloseRef.current?.click();
      router.refresh();
    },
  });

  const isCurrentPasskey = (p: Passkey) => p.credentialId === currentPasskeyId;

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
        {passkeys.map((passkey) => (
          <Card
            key={passkey.id}
            className={cn(
              !isCurrentPasskey(passkey)
                ? "bg-card/40"
                : "border-3 border-primary/20 shadow-lg bg-secondary/30"
            )}
          >
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                {/* Linke Seite: Infos */}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      { (passkey.aaguid &&
                          (PASSKEY_AUTHENTICATOR_IDS as Record<string, string>)[passkey.aaguid]) ||
                        "Unknown Authenticator App" }
                      {isCurrentPasskey(passkey) && <Badge>Current Biometric</Badge>}
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

                {/* Rechte Seite: roter Delete-Button (immer, wenn ein Eintrag existiert) */}
                <div className="sm:pt-1">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="w-full sm:w-auto"
                        title="Delete this biometric"
                      >
                        Delete biometric
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete biometric?</DialogTitle>
                        <DialogDescription>
                          This will remove this biometric from your account. This action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="mt-6 sm:mt-0">
                        <DialogClose ref={dialogCloseRef} asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button
                          variant="destructive"
                          className="mb-4 sm:mb-0"
                          onClick={() => deletePasskey({ credentialId: passkey.credentialId })}
                        >
                          Delete biometric
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}

        {passkeys.length === 0 && (
          <div className="text-center text-muted-foreground">
            No biometrics found. Add a biometric to enable passwordless authentication.
          </div>
        )}
      </div>
    </div>
  );
}
