"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteUserByEmailAction } from "@/actions/referral-actions";
import { Gift } from "lucide-react";

export default function InviteUserForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    try {
      await inviteUserByEmailAction({ email });
      setStatus("Invitation sent successfully.");
      setEmail("");
      startTransition(() => router.refresh());
    } catch (error: unknown) {
      console.error("Failed to send invitation:", error);
      let message = "Failed to send invitation.";
      if (error && typeof error === "object" && "message" in error) {
        const err = error as { message?: unknown };
        if (typeof err.message === "string") message = err.message;
      }
      setStatus(message);
    } finally {
      setSubmitting(false);
    }
  }

  const busy = isSubmitting || isPending;

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {/* animated teaser */}
      <div className="flex items-center gap-2 mb-3">
        <Gift className="h-5 w-5 text-pink-500 animate-bounce" aria-hidden />{/* animate */}
        <p className="font-semibold text-base-content/70">
          Invite friends and earn bonus credits
        </p>
      </div>

      {/* input and button with visible gap (no join) */}
      <div className="grid w-full gap-3 sm:grid-cols-[1fr_auto] items-start">
        <label htmlFor="invite-email" className="sr-only">Invite via email</label>
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          required
          className="input input-primary flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full sm:w-auto h-10 rounded-md bg-black text-white hover:bg-black/90 px-4 font-medium shadow-sm"
        >
          {busy ? (
            <>
              <span className="loading loading-spinner loading-sm" />
              Sending…
            </>
          ) : (
            "Send Invitation"
          )}
        </button>
      </div>

      {status && (
        <div role="alert" className="mt-3 border border-base-300 rounded-lg p-3 bg-base-100">
          <span>{status}</span>
        </div>
      )}
    </form>
  );
}
