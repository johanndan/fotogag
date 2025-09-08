// /src/app/(settings)/settings/security/passkey.client.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { useSessionStore } from "@/state/session";
import { userSettingsSchema } from "@/schemas/settings.schema";
import { useServerAction } from "zsa-react";
import { updateUserProfileAction } from "./settings.actions";

// Aktionen
import { deleteUserAction } from "@/app/(admin)/admin/users/[userId]/delete-user.action";
import {
  deleteSessionAction,
  deleteAllSessionsOfUserAction,
} from "@/app/(settings)/settings/sessions/sessions.actions";

// Biometrics-UI
import { PasskeysList } from "@/app/(settings)/settings/security/passkey.client";

/* ------------------------------ Konstanten ------------------------------- */
const SIGNIN_URL = "https://photogag.ai/";
/* ------------------------------------------------------------------------ */

/* ------------------------------ Helpers ---------------------------------- */
function getOwnUserId(user: unknown): string | undefined {
  if (user && typeof user === "object" && "id" in user) {
    const id = (user as Record<string, unknown>).id;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

function getOwnSessionId(session: unknown): string | undefined {
  if (session && typeof session === "object" && "id" in session) {
    const id = (session as Record<string, unknown>).id;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

async function doLogout(): Promise<void> {
  try {
    const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    if (!res.ok) {
      await fetch("/api/auth/logout", { method: "GET", credentials: "include" });
    }
  } catch {
    // ignorieren – wir leiten gleich weiter
  }
}
/* ------------------------------------------------------------------------ */

export function SettingsForm() {
  const router = useRouter();

  const { execute: updateUserProfile } = useServerAction(updateUserProfileAction, {
    onError: (error) => {
      toast.dismiss();
      toast.error(error.err?.message);
    },
    onStart: () => {
      toast.loading("Saving changes...");
    },
    onSuccess: () => {
      toast.dismiss();
      toast.success("Saved successfully");
      router.refresh();
    },
  });

  const { execute: deleteAllSessionsOfUser } = useServerAction(deleteAllSessionsOfUserAction, {
    onError: (err) => {
      toast.message(err.err?.message ?? "Could not delete all sessions");
    },
  });

  const { execute: deleteCurrentSession } = useServerAction(deleteSessionAction, {
    onError: (err) => {
      toast.message(err.err?.message ?? "Could not delete current session");
    },
  });

  const { execute: deleteOwnAccount, isPending: isDeleting } = useServerAction(deleteUserAction, {
    onError: (err) => {
      toast.dismiss();
      toast.error(err.err?.message ?? "Failed to delete account");
    },
    onStart: () => {
      toast.loading("Deleting account…");
    },
    onSuccess: () => {
      toast.dismiss();
      toast.success("Account deleted");
    },
  });

  const { session, isLoading } = useSessionStore();

  const form = useForm<z.infer<typeof userSettingsSchema>>({
    resolver: zodResolver(userSettingsSchema),
  });

  useEffect(() => {
    form.reset({
      firstName: session?.user.firstName ?? "",
      lastName: session?.user.lastName ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!session || isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <Skeleton className="h-8 w-[200px]" />
            <Skeleton className="h-4 w-[300px]" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>

            <div className="space-y-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-[200px]" />
            </div>

            <div className="flex justify-end">
              <Skeleton className="h-10 w-[100px]" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  async function onSubmit(values: z.infer<typeof userSettingsSchema>) {
    updateUserProfile(values);
  }

  // Alle Sessions killen + Account löschen + aktuelle Session entfernen + Logout + weiterleiten
  const handleDeleteConfirm = async () => {
    const userId = getOwnUserId(session?.user);
    if (!userId) {
      toast.error("Missing user id on session");
      return;
    }

    const currentSessionId = getOwnSessionId(session);

    // 1) Alle anderen Sessions sofort invalidieren (dieses Tab ggf. noch behalten)
    await deleteAllSessionsOfUser({ keepCurrentSessionId: currentSessionId });

    // 2) Account löschen
    await deleteOwnAccount({ userId });

    // 3) Auch die aktuelle Session entfernen (KV sauber machen)
    if (currentSessionId) {
      await deleteCurrentSession({ sessionId: currentSessionId });
    }

    // 4) Logout (Cookies serverseitig löschen) + externer Redirect auf Startseite
    await doLogout();
    window.location.replace(SIGNIN_URL);
  };

  return (
    <div className="space-y-6">
      {/* Profil-Einstellungen */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>Update your personal information and contact details.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" disabled value={session.user.email ?? ""} />
                </FormControl>
                <FormDescription>This is the email you use to sign in.</FormDescription>
                <FormMessage />
              </FormItem>

              {/* Button-Zeile: links Save (schwarz), rechts Delete (destructive) */}
              <div className="flex items-center justify-between">
                <Button type="submit" className="bg-black text-white hover:bg-black/90">
                  Save changes
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      aria-label="Delete account"
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Deleting…" : "Delete account"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. Your account and all related data will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteConfirm}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Confirm
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Change Password – 100% Breite, Button schwarz/links */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Set a new password. We’ll send a secure link to your email address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            asChild
            className="bg-black text-white hover:bg-black/90"
          >
            <Link href={`/forgot-password?email=${encodeURIComponent(session.user.email ?? "")}`}>
              Send reset link
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Biometric login – letzter Bereich, 100% Breite, mit integrierter PasskeysList */}
      <Card>
        <CardHeader>
          <CardTitle>Biometric login</CardTitle>
          <CardDescription>Register and manage your biometrics (passkeys).</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <PasskeysList
            passkeys={[]}
            currentPasskeyId={null}
            email={session.user.email ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
