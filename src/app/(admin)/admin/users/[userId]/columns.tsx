"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useTransition } from "react";
import { deleteUserAction } from "./delete-user.action";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type AdminUserRow = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  // ggf. weitere Felder
};

type ActionsCellProps = {
  user: AdminUserRow;
};

function ActionsCell({ user }: ActionsCellProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onDelete = React.useCallback(() => {
    const email = user.email ?? user.id;
    if (
      !confirm(
        `Delete user "${email}"?\n\nThis action is irreversible. Continue?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await deleteUserAction({ userId: user.id });
        if ((res as { success?: boolean })?.success) {
          toast.success(`User "${email}" deleted`);
          router.refresh();
        } else {
          toast.error("Failed to delete user");
        }
      } catch (e: unknown) {
        const err = e as { err?: { message?: string } };
        toast.error(err?.err?.message ?? "Failed to delete user");
      }
    });
  }, [router, user.email, user.id]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 w-8 p-0"
          aria-label="Open actions"
          disabled={isPending}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Platz für weitere Aktionen wie View/Edit */}
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={(e) => {
            e.preventDefault();
            onDelete();
          }}
          disabled={isPending}
        >
          Delete User
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const userColumns: ColumnDef<AdminUserRow>[] = [
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => row.original.email ?? "—",
  },
  {
    accessorKey: "firstName",
    header: "First name",
    cell: ({ row }) => row.original.firstName ?? "—",
  },
  {
    accessorKey: "lastName",
    header: "Last name",
    cell: ({ row }) => row.original.lastName ?? "—",
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <ActionsCell user={row.original} />,
    enableHiding: false,
    size: 80,
  },
];
