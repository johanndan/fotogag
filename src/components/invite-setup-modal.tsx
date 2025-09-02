// src/components/invite-setup-modal.tsx
"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { completeInviteAction } from "@/app/(auth)/sign-up/complete-invite.action";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function InviteSetupModal() {
  const search = useSearchParams();
  const router = useRouter();

  const invited = search.get("invited") === "1";
  const invitation = search.get("invitation") ?? "";
  const email = search.get("email") ?? "";

  const [open, setOpen] = React.useState(invited && !!invitation && !!email);
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const disabled = !firstName || password.length < 8 || !invitation || !email;

  // Modal schließen, wenn Invite-Parameter fehlen
  React.useEffect(() => {
    if (!(invited && invitation && email)) {
      setOpen(false);
    }
  }, [invited, invitation, email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || pending) return;

    setPending(true);
    try {
      const res = await completeInviteAction({
        invitation,
        email,
        firstName,
        lastName,
        password,
      });

      if (res && typeof res === "object" && "ok" in res && (res as { ok?: boolean }).ok) {
        // Erfolgreich → direkt ins Dashboard
        router.replace("/dashboard");
        return;
      }

      // Falls die Action nichts oder unerwartetes liefert:
      alert("Failed to complete invitation.");
    } catch (err) {
      console.error(err);
      alert("Failed to complete invitation.");
    } finally {
      setPending(false);
    }
  }

  if (!invited || !invitation || !email) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete your invitation</DialogTitle>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Email (fixed)</Label>
            <Input value={email} disabled />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>First name</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g., Anna"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Last name (optional)</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g., Müller"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Password (min. 8 chars)</Label>
            <Input
              type="password"
              value={password}
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a password"
              required
            />
          </div>

          <div className="pt-2">
            <Button type="submit" disabled={disabled || pending}>
              {pending ? "Saving…" : "Finish sign-up"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
