// src/app/(admin)/admin/users/[userId]/columns.tsx
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
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";            // ← wichtig
import { deleteUserAction } from "./delete-user.action";

export type AdminUserRow = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

type ActionsCellProps = { user: AdminUserRow };

function ActionsCell({ user }: ActionsCellProps) {
  const router = useRouter();

  // ZSA-React: typed execute() mit { userId }
  const { execute, isPending } = useServerAction(deleteUserAction, {
    onError: (err) => {
      // err.err?.message ist das, was wir in der Action via ZSAError liefern
      toast.error(err.err?.message ?? "Delete failed");
    },
    onSuccess: () => {
      toast.success(`User "${user.email ?? user.id}" deleted`);
      // Liste aktualisieren
      router.refresh();
    },
  });

  const onDelete = React.useCallback(() => {
    const email = user.email ?? user.id;
    if (!confirm(`Delete user "${email}"?\n\nThis action is irreversible. Continue?`)) {
      return;
    }
    // WICHTIG: kein FormData – Action will { userId }
    execute({ userId: user.id });
  }, [execute, user.id, user.email]);

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
  { accessorKey: "email", header: "Email", cell: ({ row }) => row.original.email ?? "—" },
  { accessorKey: "firstName", header: "First name", cell: ({ row }) => row.original.firstName ?? "—" },
  { accessorKey: "lastName", header: "Last name", cell: ({ row }) => row.original.lastName ?? "—" },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <ActionsCell user={row.original} />,
    enableHiding: false,
    size: 80,
  },
];
