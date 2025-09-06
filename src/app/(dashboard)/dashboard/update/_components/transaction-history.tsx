// src/app/(dashboard)/dashboard/billing/_components/transaction-history.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTransactions } from "@/actions/credits.action";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, isPast } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useTransactionStore } from "@/state/transaction";
import { useQueryState } from "nuqs";

type TransactionData = Awaited<ReturnType<typeof getTransactions>>;
type Tx = TransactionData["transactions"][number];

function isTransactionExpired(tx: Tx): boolean {
  return tx.expirationDate ? isPast(new Date(tx.expirationDate)) : false;
}

// Streng typisierte Label-Funktion (kein any, keine Assertions).
function typeLabel(tx: { type?: string | null; description?: string | null; paymentIntentId?: string | null }) {
  const t = (tx.type ?? "").toUpperCase();
  if (t === "USAGE") return "Usage";

  // Heuristik: „Bonus“, wenn Beschreibung nach Referral/Daily klingt
  const desc = tx.description ?? "";
  const looksLikeBonus = /referral|invite|daily|bonus/i.test(desc);

  if (t === "PURCHASE") {
    return looksLikeBonus ? "Bonus" : "Purchase";
  }
  // alle sonstigen Gutschriften als Bonus anzeigen
  return "Bonus";
}

export function TransactionHistory() {
  const [data, setData] = useState<TransactionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useQueryState("page", { defaultValue: "1" });
  const refreshTrigger = useTransactionStore((s) => s.refreshTrigger);

  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoading(true);
      try {
        const result = await getTransactions({ page: parseInt(page, 10) });
        setData(result);
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTransactions();
  }, [page, refreshTrigger]);

  const handlePageChange = (newPage: number) => {
    setPage(String(newPage));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Transaction History</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Transaction History</CardTitle></CardHeader>
      <CardContent>
        {/* Desktop */}
        <div className="hidden md:block">
          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.transactions?.length ? (
                  data.transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{format(new Date(tx.createdAt), "MMM d, yyyy")}</TableCell>
                      <TableCell className="capitalize">{typeLabel(tx)}</TableCell>
                      <TableCell className={
                        tx.type === "USAGE"
                          ? "text-red-500"
                          : isTransactionExpired(tx)
                            ? "text-orange-500"
                            : "text-green-500"
                      }>
                        {tx.type === "USAGE" ? "-" : "+"}
                        {Math.abs(tx.amount)}
                      </TableCell>
                      <TableCell>
                        {tx.description}
                        {tx.type !== "USAGE" && tx.expirationDate && (
                          <Badge
                            variant="secondary"
                            className={`mt-1 ml-3 font-normal text-[0.75rem] leading-[1rem] ${
                              isTransactionExpired(tx) ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-muted"
                            }`}
                          >
                            {isTransactionExpired(tx) ? "Expired: " : "Expires: "}
                            {format(new Date(tx.expirationDate), "MMM d, yyyy")}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center">No transactions found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Mobile */}
        <div className="md:hidden space-y-4">
          {data?.transactions?.length ? (
            data.transactions.map((tx) => (
              <div key={tx.id} className="flex flex-col space-y-2 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{format(new Date(tx.createdAt), "MMM d, yyyy")}</span>
                  <span className="capitalize text-sm">{typeLabel(tx)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{tx.description}</span>
                  <span className={
                    tx.type === "USAGE"
                      ? "text-red-500"
                      : isTransactionExpired(tx)
                        ? "text-orange-500"
                        : "text-green-500"
                  }>
                    {tx.type === "USAGE" ? "-" : "+"}
                    {Math.abs(tx.amount)}
                  </span>
                </div>
                {tx.type !== "USAGE" && tx.expirationDate && (
                  <Badge
                    variant="secondary"
                    className={`self-start font-normal text-[0.75rem] leading-[1rem] ${
                      isTransactionExpired(tx) ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-muted"
                    }`}
                  >
                    {isTransactionExpired(tx) ? "Expired: " : "Expires: "}
                    {format(new Date(tx.expirationDate), "MMM d, yyyy")}
                  </Badge>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">No transactions found</div>
          )}
        </div>

        {data?.pagination?.pages && data.pagination.pages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => handlePageChange(Math.max(1, parseInt(page, 10) - 1))} disabled={parseInt(page, 10) === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} of {data?.pagination.pages ?? 1}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.min(data?.pagination.pages ?? 1, parseInt(page, 10) + 1))}
              disabled={parseInt(page, 10) === (data?.pagination.pages ?? 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
