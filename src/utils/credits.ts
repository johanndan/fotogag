import "server-only";
import { eq, sql, desc, and, lt, isNull, gt, or, asc } from "drizzle-orm";
import { getDB } from "@/db";
import { userTable, creditTransactionTable, CREDIT_TRANSACTION_TYPE, purchasedItemsTable, appSettingTable } from "@/db/schema";
import { updateAllSessionsOfUser, KVSession } from "./kv-session";
import { CREDIT_PACKAGES, FREE_MONTHLY_CREDITS } from "@/constants";

export type CreditPackage = typeof CREDIT_PACKAGES[number];

export function getCreditPackage(packageId: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((pkg) => pkg.id === packageId);
}

function shouldRefreshCredits(session: KVSession, currentTime: Date): boolean {
  if (!session.user.lastCreditRefreshAt) {
    return true;
  }
  const oneMonthAfterLastRefresh = new Date(session.user.lastCreditRefreshAt);
  oneMonthAfterLastRefresh.setMonth(oneMonthAfterLastRefresh.getMonth() + 1);
  return currentTime >= oneMonthAfterLastRefresh;
}

async function processExpiredCredits(userId: string, currentTime: Date) {
  const db = getDB();
  const expiredTransactions = await db.query.creditTransactionTable.findMany({
    where: and(
      eq(creditTransactionTable.userId, userId),
      lt(creditTransactionTable.expirationDate, currentTime),
      isNull(creditTransactionTable.expirationDateProcessedAt),
      gt(creditTransactionTable.remainingAmount, 0),
    ),
    orderBy: [
      desc(sql`CASE WHEN ${creditTransactionTable.type} = ${CREDIT_TRANSACTION_TYPE.MONTHLY_REFRESH} THEN 1 ELSE 0 END`),
      asc(creditTransactionTable.createdAt),
    ],
  });
  for (const transaction of expiredTransactions) {
    try {
      await db
        .update(creditTransactionTable)
        .set({
          expirationDateProcessedAt: currentTime,
          remainingAmount: 0,
        })
        .where(eq(creditTransactionTable.id, transaction.id));
      await db
        .update(userTable)
        .set({
          currentCredits: sql`${userTable.currentCredits} - ${transaction.remainingAmount}`,
        })
        .where(eq(userTable.id, userId));
    } catch (error) {
      console.error(`Failed to process expired credits for transaction ${transaction.id}:`, error);
      continue;
    }
  }
}

export async function updateUserCredits(userId: string, delta: number): Promise<void> {
  const db = getDB();
  await db
    .update(userTable)
    .set({
      currentCredits: sql`${userTable.currentCredits} + ${delta}`,
    })
    .where(eq(userTable.id, userId));
  await updateAllSessionsOfUser(userId);
}

async function updateLastRefreshDate(userId: string, date: Date) {
  const db = getDB();
  await db
    .update(userTable)
    .set({
      lastCreditRefreshAt: date,
    })
    .where(eq(userTable.id, userId));
}

export async function logTransaction({
  userId,
  amount,
  description,
  type,
  expirationDate,
  paymentIntentId,
}: {
  userId: string;
  amount: number;
  description: string;
  type: keyof typeof CREDIT_TRANSACTION_TYPE;
  expirationDate?: Date;
  paymentIntentId?: string;
}) {
  const db = getDB();
  await db.insert(creditTransactionTable).values({
    userId,
    amount,
    remainingAmount: amount,
    type,
    description,
    expirationDate,
    paymentIntentId,
  });
}

export async function addFreeMonthlyCreditsIfNeeded(session: KVSession): Promise<number> {
  const currentTime = new Date();
  if (shouldRefreshCredits(session, currentTime)) {
    const db = getDB();
    const user = await db.query.userTable.findFirst({
      where: eq(userTable.id, session.userId),
      columns: {
        lastCreditRefreshAt: true,
        currentCredits: true,
      },
    });
    if (
      !shouldRefreshCredits({ ...session, user: { ...session.user, lastCreditRefreshAt: user?.lastCreditRefreshAt ?? null } }, currentTime)
    ) {
      return user?.currentCredits ?? 0;
    }
    await processExpiredCredits(session.userId, currentTime);
    const expirationDate = new Date(currentTime);
    expirationDate.setMonth(expirationDate.getMonth() + 1);
    await updateUserCredits(session.userId, FREE_MONTHLY_CREDITS);
    await logTransaction({
      userId: session.userId,
      amount: FREE_MONTHLY_CREDITS,
      description: "Free monthly credits",
      type: CREDIT_TRANSACTION_TYPE.MONTHLY_REFRESH,
      expirationDate,
    });
    await updateLastRefreshDate(session.userId, currentTime);
    const updatedUser = await db.query.userTable.findFirst({
      where: eq(userTable.id, session.userId),
      columns: {
        currentCredits: true,
      },
    });
    return updatedUser?.currentCredits ?? 0;
  }
  return session.user.currentCredits;
}

export async function hasEnoughCredits({ userId, requiredCredits }: { userId: string; requiredCredits: number }) {
  const user = await getDB().query.userTable.findFirst({
    where: eq(userTable.id, userId),
    columns: {
      currentCredits: true,
    },
  });
  if (!user) return false;
  return user.currentCredits >= requiredCredits;
}

export async function consumeCredits({ userId, amount, description }: { userId: string; amount: number; description: string }) {
  const db = getDB();
  const user = await db.query.userTable.findFirst({
    where: eq(userTable.id, userId),
    columns: {
      currentCredits: true,
    },
  });
  if (!user || user.currentCredits < amount) {
    throw new Error("Insufficient credits");
  }
  const activeTransactionsWithBalance = await db.query.creditTransactionTable.findMany({
    where: and(
      eq(creditTransactionTable.userId, userId),
      gt(creditTransactionTable.remainingAmount, 0),
      isNull(creditTransactionTable.expirationDateProcessedAt),
      or(isNull(creditTransactionTable.expirationDate), gt(creditTransactionTable.expirationDate, new Date())),
    ),
    orderBy: [asc(creditTransactionTable.createdAt)],
  });
  let remainingToDeduct = amount;
  for (const transaction of activeTransactionsWithBalance) {
    if (remainingToDeduct <= 0) break;
    const deductFromThis = Math.min(transaction.remainingAmount, remainingToDeduct);
    await db
      .update(creditTransactionTable)
      .set({
        remainingAmount: transaction.remainingAmount - deductFromThis,
      })
      .where(eq(creditTransactionTable.id, transaction.id));
    remainingToDeduct -= deductFromThis;
  }
  await db
    .update(userTable)
    .set({
      currentCredits: sql`${userTable.currentCredits} - ${amount}`,
    })
    .where(eq(userTable.id, userId));
  await db.insert(creditTransactionTable).values({
    userId,
    amount: -amount,
    remainingAmount: 0,
    type: CREDIT_TRANSACTION_TYPE.USAGE,
    description,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const updatedUser = await db.query.userTable.findFirst({
    where: eq(userTable.id, userId),
    columns: {
      currentCredits: true,
    },
  });
  await updateAllSessionsOfUser(userId);
  return updatedUser?.currentCredits ?? 0;
}

export async function getCreditTransactions({ userId, page = 1, limit = 10 }: { userId: string; page?: number; limit?: number }) {
  const db = getDB();
  const transactions = await db.query.creditTransactionTable.findMany({
    where: eq(creditTransactionTable.userId, userId),
    orderBy: [desc(creditTransactionTable.createdAt)],
    limit,
    offset: (page - 1) * limit,
    columns: {
      expirationDateProcessedAt: false,
      remainingAmount: false,
      userId: false,
    },
  });
  const total = await db
    .select({ count: sql<number>`count(*)` })
    .from(creditTransactionTable)
    .where(eq(creditTransactionTable.userId, userId))
    .then((result) => result[0].count);
  return {
    transactions,
    pagination: {
      total,
      pages: Math.ceil(total / limit),
      current: page,
    },
  };
}

export async function getUserPurchasedItems(userId: string) {
  const db = getDB();
  const purchasedItems = await db.query.purchasedItemsTable.findMany({
  where: eq(purchasedItemsTable.userId, userId),
  });
  return new Set(purchasedItems.map((item) => `${item.itemType}:${item.itemId}`));
}

export async function awardReferralCredits(inviterId: string, inviteeId: string): Promise<void> {
  const db = getDB();
  const [referralSetting, signupSetting] = await Promise.all([
    db.query.appSettingTable.findFirst({
      where: eq(appSettingTable.key, "referral_bonus_credits"),
      columns: { value: true },
    }),
    db.query.appSettingTable.findFirst({
      where: eq(appSettingTable.key, "default_registration_credits"),
      columns: { value: true },
    }),
  ]);
  const referralBonus = Number(referralSetting?.value ?? 0);
  const signupBonus = Number(signupSetting?.value ?? 0);
  if (referralBonus > 0) {
    await updateUserCredits(inviterId, referralBonus);
  }
  if (signupBonus > 0) {
    await updateUserCredits(inviteeId, signupBonus);
  }
}
