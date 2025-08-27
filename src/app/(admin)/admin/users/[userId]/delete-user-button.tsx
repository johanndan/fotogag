// src/app/(admin)/admin/users/[userId]/delete-user-button.tsx
"use client";

import { useRouter } from "next/navigation";
import { useServerAction } from "zsa-react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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

import { deleteUserAction } from "./delete-user.action";

type Props = { userId: string; email?: string | null };

export default function DeleteUserButton({ userId, email }: Props) {
  const router = useRouter();

  const { execute, isPending } = useServerAction(deleteUserAction, {
    onError: (err) => {
      toast.error(err.err?.message ?? "Failed to delete user");
    },
    onSuccess: () => {
      toast.success("User deleted");
      // WICHTIG: auf vorhandene Route gehen und kein Route-Typing erzwingen
      router.replace("/admin");
    },
  });

  const handleConfirm = () => execute({ userId });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isPending}>
          <Trash2 className="h-4 w-4 mr-1" />
          {isPending ? "Deleting…" : "Delete User"}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete user?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The account
            {email ? ` (${email})` : ""} and related data will be permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
