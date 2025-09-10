// src/app/(settings)/settings/settings-form.tsx
"use client";

import React, { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { useSessionStore } from "@/state/session";
import { userSettingsSchema } from "@/schemas/settings.schema";
import { useServerAction } from "zsa-react";
import { updateUserProfileAction } from "./settings.actions";

// Aktionen (Logik UNVERÄNDERT)
import { deleteUserAction } from "@/app/(admin)/admin/users/[userId]/delete-user.action";
import {
  deleteSessionAction,
  deleteAllSessionsOfUserAction,
  getSessionsAction,
} from "@/app/(settings)/settings/sessions/sessions.actions";

import { PasskeysList } from "./security/passkey.client";
import { SessionsClient } from "./sessions/sessions.client";
import type { ParsedUserAgent, SessionWithMeta } from "@/types";

/* ------------------------------ Konstanten ------------------------------- */
const SIGNIN_URL = "https://photogag.ai/";
const CLOSE_SETTINGS_URL = "https://photogag.ai/dashboard";

/* ------------------------------ Prop-Typen -------------------------------- */
type PasskeyForProps = {
  id: string;
  credentialId: string;
  userId: string;
  createdAt: Date;
  aaguid: string | null;
  userAgent: string | null;
  parsedUserAgent?: ParsedUserAgent;
};

type SettingsFormProps = {
  passkeys: PasskeyForProps[];
  currentPasskeyId: string | null;
  email: string | null;
};
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
    if (!res.ok) await fetch("/api/auth/logout", { method: "GET", credentials: "include" });
  } catch {}
}

/* ----------------- Inline-Panel: Logged-in devices (via ZSA) ------------- */
function SessionsInlinePanel() {
  const { execute: fetchSessions } = useServerAction(getSessionsAction);
  const [rows, setRows] = useState<SessionWithMeta[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [data, error] = await fetchSessions();
      if (!alive) return;
      if (error) {
        toast.error(error.message ?? "Failed to load devices");
      } else {
        setRows(data);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [fetchSessions]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[70px] w-full" />)}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return <div className="text-sm text-muted-foreground">No logged-in devices found.</div>;
  }

  return <SessionsClient sessions={rows} />;
}
/* ------------------------------------------------------------------------ */

export function SettingsForm({ passkeys, currentPasskeyId, email }: SettingsFormProps) {
  const router = useRouter();

  const { execute: updateUserProfile } = useServerAction(updateUserProfileAction, {
    onError: ({ err }) => { toast.dismiss(); toast.error(err.message); },
    onStart: () => { toast.loading("Saving changes..."); },
    onSuccess: () => { toast.dismiss(); toast.success("Saved successfully"); router.refresh(); },
  });

  const { execute: deleteAllSessionsOfUser } = useServerAction(deleteAllSessionsOfUserAction, {
    onError: ({ err }) => { toast.message(err.message ?? "Could not delete all sessions"); },
  });

  const { execute: deleteCurrentSession } = useServerAction(deleteSessionAction, {
    onError: ({ err }) => { toast.message(err.message ?? "Could not delete current session"); },
  });

  const { execute: deleteOwnAccount, isPending: isDeleting } = useServerAction(deleteUserAction, {
    onError: ({ err }) => { toast.dismiss(); toast.error(err.message ?? "Failed to delete account"); },
    onStart: () => { toast.loading("Deleting account…"); },
    onSuccess: () => { toast.dismiss(); toast.success("Account deleted"); },
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
  }, [session, form]);

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

  const handleDeleteConfirm = async () => {
    const userId = getOwnUserId(session?.user);
    if (!userId) { toast.error("Missing user id on session"); return; }

    const currentSessionId = getOwnSessionId(session);
    await deleteAllSessionsOfUser({ keepCurrentSessionId: currentSessionId });
    await deleteOwnAccount({ userId });
    if (currentSessionId) await deleteCurrentSession({ sessionId: currentSessionId });

    await doLogout();
    window.location.replace(SIGNIN_URL);
  };

  // Close Menu Button -> lädt direkt die Settings-URL neu
  const handleCloseMenu = () => {
    window.location.assign(CLOSE_SETTINGS_URL);
  };

  return (
    <div className="space-y-4">
      <Accordion type="single" collapsible defaultValue="profile">
        {/* Profile Settings (default open) */}
        <AccordionItem value="profile">
          <AccordionTrigger className="text-left">Profile Settings</AccordionTrigger>
          <AccordionContent>
            <div className="rounded-xl border bg-card">
              <CardHeader>
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

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Button
                        type="submit"
                        className="w-full sm:w-auto bg-black text-white hover:bg-black/90
                                   dark:bg-white dark:text-black dark:hover:bg-white/90"
                      >
                        Save changes
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Change Password */}
        <AccordionItem value="password">
          <AccordionTrigger className="text-left">Change Password</AccordionTrigger>
          <AccordionContent>
            <div className="rounded-xl border bg-card">
              <CardHeader className="px-4 py-3">
                <CardDescription>
                  Set a new password. We’ll send a secure link to your email address.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 py-3">
                <Button
                  asChild
                  className="w-full sm:w-auto bg-black text-white hover:bg-black/90
                             dark:bg-white dark:text-black dark:hover:bg-white/90"
                >
                  <Link href={`/forgot-password?email=${encodeURIComponent(session.user.email ?? "")}`}>
                    Send reset link
                  </Link>
                </Button>
              </CardContent>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Biometric login */}
        <AccordionItem value="biometric">
          <AccordionTrigger className="text-left">Biometric login</AccordionTrigger>
          <AccordionContent>
            <div className="rounded-xl border bg-card">
              <CardHeader className="px-4 py-3">
                <CardDescription>Register and manage your passkeys.</CardDescription>
              </CardHeader>
              <CardContent className="px-0 py-0">
                <div className="p-4">
                  <PasskeysList
                    passkeys={passkeys}
                    currentPasskeyId={currentPasskeyId}
                    email={email}
                  />
                </div>
              </CardContent>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Logged-in devices */}
        <AccordionItem value="devices">
          <AccordionTrigger className="text-left">Logged-in devices</AccordionTrigger>
          <AccordionContent>
            <div className="rounded-xl border bg-card">
              <CardHeader>
                <CardDescription>Manage your logged-in devices</CardDescription>
              </CardHeader>
              <CardContent>
                <SessionsInlinePanel />
              </CardContent>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Delete account – ganz unten */}
        <AccordionItem value="delete">
          <AccordionTrigger className="text-left text-destructive">Delete account</AccordionTrigger>
          <AccordionContent>
            <div className="rounded-xl border bg-card border-destructive/30">
              <CardHeader>
                <CardDescription className="text-destructive">
                  Deleting your account is permanent. This action cannot be undone and will remove your
                  profile and all associated data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    Proceed only if you are sure you want to permanently delete your account.
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        aria-label="Delete account"
                        disabled={isDeleting}
                        className="w-full sm:w-auto"
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
              </CardContent>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Close Menu Button – mittig & fett */}
      <div className="mt-8 flex justify-center">
        <Button onClick={handleCloseMenu} className="font-bold">
          Close Menu
        </Button>
      </div>
    </div>
  );
}
