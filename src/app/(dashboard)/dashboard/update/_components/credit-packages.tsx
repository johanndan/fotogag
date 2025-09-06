"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { CREDIT_PACKAGES } from "@/constants";
import { createPaymentIntent } from "@/actions/credits.action";
import { StripePaymentForm } from "./stripe-payment-form";

import { Coins, Gift } from "lucide-react";
import { toast } from "sonner";

import { useSessionStore } from "@/state/session";
import { useTransactionStore } from "@/state/transaction";

type CreditPackage = (typeof CREDIT_PACKAGES)[number];

const calculateSavings = (pkg: CreditPackage) => {
  const basePackage = CREDIT_PACKAGES[0];
  const basePrice = basePackage.price / basePackage.credits;
  const currentPrice = pkg.price / pkg.credits;
  const savings = ((basePrice - currentPrice) / basePrice) * 100;
  return Math.round(savings);
};

/** Named export (ggf. von StripePaymentForm genutzt) */
export const getPackageIcon = (index: number) => {
  void index; // als verwendet markieren, damit ESLint nicht meckert
  return <Coins className="h-5 w-5 text-yellow-500" />;
};

export function CreditPackages({
  freeMonthlyCredits,
  referralBonusCredits,
}: {
  freeMonthlyCredits: number;
  referralBonusCredits?: number;
}) {
  const router = useRouter();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const sessionStore = useSessionStore();
  const triggerTransactionsRefresh = useTransactionStore((s) => s.triggerRefresh);

  const sessionIsLoading = sessionStore?.isLoading;
  const currentCredits = sessionStore?.session?.user?.currentCredits ?? 0;

  const bonusCredits = referralBonusCredits ?? freeMonthlyCredits;

  const nf = useMemo(() => new Intl.NumberFormat("en-US"), []);

  const handlePurchase = async (pkg: CreditPackage) => {
    try {
      const { clientSecret } = await createPaymentIntent({ packageId: pkg.id });
      setClientSecret(clientSecret);
      setSelectedPackage(pkg);
      setIsDialogOpen(true);
    } catch (error) {
      console.error("Error creating payment intent:", error);
      toast.error("Could not start checkout. Please try again.");
    }
  };

  const handleSuccess = () => {
    setIsDialogOpen(false);
    setSelectedPackage(null);
    setClientSecret(null);
    router.refresh();
    triggerTransactionsRefresh();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Credits</CardTitle>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Aktuelle Credits + Hinweis */}
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              {sessionIsLoading ? (
                <>
                  <Skeleton className="h-9 w-16" />
                  <Skeleton className="h-9 w-24" />
                </>
              ) : (
                <div className="text-3xl font-bold">
                  {nf.format(currentCredits)} credits
                </div>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              You receive <span className="font-medium">{nf.format(freeMonthlyCredits)}</span> free
              credits each month.
            </div>
          </div>

          {/* Kopf + Luft nach unten */}
          <div className="space-y-4 pt-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold">Top up your credits</h2>
              <p className="text-sm text-muted-foreground mt-2 sm:mt-3 mb-8">
                Buy extra credits whenever you need them. Larger packs offer better value.
              </p>
            </div>

            {/* Vier Karten (Invite + drei Kaufpakete) */}
            <div className="grid gap-4 xl:grid-cols-4">
              {/* BONUS / INVITE */}
              <Card className="relative overflow-hidden transition-all hover:shadow-xl bg-background border rounded-2xl min-h-[400px] xl:min-h-[460px]">
                <CardContent className="flex flex-col h-full p-5 sm:p-6 font-bold">
                  <div className="text-center">
                    <div className="text-2xl tracking-tight">Bonus Credits</div>
                    <hr className="my-2 border-t border-gray-300 w-48 mx-auto" />
                    <div className="mt-1 mb-10 text-lg tracking-wide">Invite Reward</div>
                  </div>

                  {/* (Divider entfernt) */}

                  {/* € links – Credits rechts */}
                  <div className="flex items-start justify-between gap-3 mt-6">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <Gift className="h-8 w-8 shrink-0 text-pink-500 animate-bounce" aria-hidden />{/* animate */}
                        <div className="text-3xl sm:text-4xl text-primary">€0</div>
                      </div>
                      <span className="mt-2 text-xs text-transparent select-none">_</span>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl sm:text-3xl">{nf.format(bonusCredits)}</div>
                      <div className="text-xs text-muted-foreground">credits</div>
                    </div>
                  </div>

                  <p className="mt-12 text-xs text-muted-foreground font-normal">
                    Invite a friend and earn {nf.format(bonusCredits)} bonus credits.
                  </p>

                  <div className="mt-auto" />
                  <Button asChild className="w-full mt-5">
                    <Link href="/dashboard/invite">Invite</Link>
                  </Button>
                </CardContent>
              </Card>

              {/* KAUF-PAKETE */}
              {CREDIT_PACKAGES.map((pkg, index) => (
                <Card
                  key={pkg.id}
                  className="relative overflow-hidden transition-all hover:shadow-xl bg-background border rounded-2xl min-h-[400px] xl:min-h-[460px]"
                >
                  <CardContent className="flex flex-col h-full p-5 sm:p-6 font-bold">
                    <div className="text-center">
                      <div className="text-2xl tracking-tight">One-Time Payment</div>
                      <hr className="my-2 border-t border-gray-300 w-48 mx-auto" />
                      <div className="mt-1 mb-10 text-lg tracking-wide">Quick Top-Up</div>
                    </div>

                    {/* (Divider entfernt) */}

                    {/* Preis links – Credits rechts */}
                    <div className="flex items-start justify-between gap-3 mt-6">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <Coins className="h-6 w-6 text-yellow-500" />
                          <div className="text-3xl sm:text-4xl text-primary">€{pkg.price}</div>
                        </div>

                          {index > 0 ? (
                            <span className="mt-2 ml-10 text-xs text-green-600 dark:text-green-400">
                              Save {calculateSavings(pkg)}%
                            </span>
                          ) : (
                            <span className="mt-2 ml-10 text-xs text-transparent select-none">_</span>
                          )}
                      </div>

                      <div className="text-right">
                        <div className="text-2xl sm:text-3xl">{nf.format(pkg.credits)}</div>
                        <div className="text-xs text-muted-foreground">credits</div>
                      </div>
                    </div>

                    <p className="mt-12 text-xs text-muted-foreground font-normal">
                      {index === 0
                        ? "Ideal for getting started."
                        : index === 1
                        ? "Ideal for regular use."
                        : "Ideal for power users."}
                    </p>

                    <div className="mt-auto" />
                    <Button
                      onClick={() => {
                        if (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
                          handlePurchase(pkg);
                        } else {
                          toast.error(
                            "Our payment provider isn’t available right now. Please try again later."
                          );
                        }
                      }}
                      className="w-full mt-5"
                    >
                      Purchase now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stripe Checkout Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purchase credits</DialogTitle>
          </DialogHeader>
          {clientSecret && selectedPackage && (
            <StripePaymentForm
              packageId={selectedPackage.id}
              clientSecret={clientSecret}
              onSuccess={handleSuccess}
              onCancel={() => setIsDialogOpen(false)}
              credits={selectedPackage.credits}
              price={selectedPackage.price}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
