// src/db/schema.ts
import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import { type InferSelectModel } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

/**
 * Role definitions for application users.
 */
export const ROLES_ENUM = {
  ADMIN: "admin",
  USER: "user",
} as const;

const roleTuple = Object.values(ROLES_ENUM) as [string, ...string[]];

// Common columns for all tables
const commonColumns = {
  createdAt: integer({ mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer({ mode: "timestamp" })
    .$onUpdateFn(() => new Date())
    .notNull(),
  updateCounter: integer().default(0).$onUpdate(() => sql`updateCounter + 1`),
};

/**
 * Primary user table.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const userTable: any = sqliteTable(
  "user",
  {
    ...commonColumns,
    id: text().primaryKey().$defaultFn(() => `usr_${createId()}`).notNull(),
    firstName: text({ length: 255 }),
    lastName: text({ length: 255 }),
    email: text({ length: 255 }).unique(),
    passwordHash: text(),
    role: text({ enum: roleTuple }).default(ROLES_ENUM.USER).notNull(),
    emailVerified: integer({ mode: "timestamp" }),
    signUpIpAddress: text({ length: 100 }),
    googleAccountId: text({ length: 255 }),
    /** absolute or relative path */
    avatar: text({ length: 600 }),
    // Credit system
    currentCredits: integer().default(0).notNull(),
    lastCreditRefreshAt: integer({ mode: "timestamp" }),
    /**
     * Optional reference to the inviter's user id.
     */
    referralUserId: text(),
  },
  (table) => [
    index("email_idx").on(table.email),
    index("google_account_id_idx").on(table.googleAccountId),
    index("role_idx").on(table.role),
    index("referral_user_id_idx").on(table.referralUserId),
  ],
);

/**
 * Passkey credentials (WebAuthn)
 */
export const passKeyCredentialTable = sqliteTable(
  "passkey_credential",
  {
    ...commonColumns,
    id: text().primaryKey().$defaultFn(() => `pkey_${createId()}`).notNull(),
    userId: text().notNull().references(() => userTable.id),
    credentialId: text({ length: 255 }).notNull().unique(),
    credentialPublicKey: text({ length: 255 }).notNull(),
    counter: integer().notNull(),
    transports: text({ length: 255 }),
    aaguid: text({ length: 255 }),
    userAgent: text({ length: 255 }),
    ipAddress: text({ length: 100 }),
  },
  (table) => [
    index("user_id_idx").on(table.userId),
    index("credential_id_idx").on(table.credentialId),
  ],
);

/**
 * Credit transactions
 */
export const CREDIT_TRANSACTION_TYPE = {
  PURCHASE: "PURCHASE",
  USAGE: "USAGE",
  MONTHLY_REFRESH: "MONTHLY_REFRESH",
} as const;

export const creditTransactionTypeTuple = Object.values(
  CREDIT_TRANSACTION_TYPE,
) as [string, ...string[]];

export const creditTransactionTable = sqliteTable(
  "credit_transaction",
  {
    ...commonColumns,
    id: text().primaryKey().$defaultFn(() => `ctxn_${createId()}`).notNull(),
    userId: text().notNull().references(() => userTable.id),
    amount: integer().notNull(),
    remainingAmount: integer().default(0).notNull(),
    type: text({ enum: creditTransactionTypeTuple }).notNull(),
    description: text({ length: 255 }).notNull(),
    expirationDate: integer({ mode: "timestamp" }),
    expirationDateProcessedAt: integer({ mode: "timestamp" }),
    paymentIntentId: text({ length: 255 }),

    // ▼▼▼ NEU: EUR-Betrag & Währung für Aggregationen ▼▼▼
    fiatAmountCents: integer().notNull().default(0),
    fiatCurrency: text().notNull().default("EUR"),
  },
  (table) => [
    index("credit_transaction_user_id_idx").on(table.userId),
    index("credit_transaction_type_idx").on(table.type),
    index("credit_transaction_created_at_idx").on(table.createdAt),
    index("credit_transaction_expiration_date_idx").on(table.expirationDate),
    index("credit_transaction_payment_intent_id_idx").on(
      table.paymentIntentId,
    ),
    // ▼▼▼ NEU: schneller filtern/aggregieren nach Währung ▼▼▼
    index("credit_transaction_fiat_currency_idx").on(table.fiatCurrency),
  ],
);

/**
 * Purchasable items
 */
export const PURCHASABLE_ITEM_TYPE = {
  COMPONENT: "COMPONENT",
} as const;

export const purchasableItemTypeTuple = Object.values(
  PURCHASABLE_ITEM_TYPE,
) as [string, ...string[]];

export const purchasedItemsTable = sqliteTable(
  "purchased_item",
  {
    ...commonColumns,
    id: text().primaryKey().$defaultFn(() => `pitem_${createId()}`).notNull(),
    userId: text().notNull().references(() => userTable.id),
    itemType: text({ enum: purchasableItemTypeTuple }).notNull(),
    itemId: text().notNull(),
    purchasedAt: integer({ mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("purchased_item_user_id_idx").on(table.userId),
    index("purchased_item_type_idx").on(table.itemType),
    index("purchased_item_user_item_idx").on(
      table.userId,
      table.itemType,
      table.itemId,
    ),
  ],
);

/**
 * Referral invitations
 */
export const REFERRAL_INVITATION_STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  EXPIRED: "EXPIRED",
} as const;

export const referralInvitationStatusTuple = Object.values(
  REFERRAL_INVITATION_STATUS,
) as [string, ...string[]];

export const referralInvitationTable = sqliteTable(
  "referral_invitation",
  {
    ...commonColumns,
    id: text().primaryKey().$defaultFn(() => `rinv_${createId()}`).notNull(),
    token: text({ length: 255 }).notNull().unique(),
    inviterUserId: text().notNull().references(() => userTable.id),
    invitedEmail: text({ length: 255 }).notNull(),
    status: text({ enum: referralInvitationStatusTuple })
      .default(REFERRAL_INVITATION_STATUS.PENDING)
      .notNull(),
    expiresAt: integer({ mode: "timestamp" }),
    creditsAwarded: integer().default(0).notNull(),
  },
  (table) => [
    index("referral_invitation_inviter_idx").on(table.inviterUserId),
    index("referral_invitation_email_idx").on(table.invitedEmail),
    index("referral_invitation_token_idx").on(table.token),
  ],
);

/**
 * ▼▼▼ NEU: App Settings (Key/Value) ▼▼▼
 * - default_registration_credits
 * - referral_bonus_credits
 * - credits_per_eur
 */
export const appSettingTable = sqliteTable(
  "app_setting",
  {
    ...commonColumns,
    key: text().primaryKey().notNull(),
    value: text().notNull(),
  },
  () => [],
);

// ---------- Relations ----------
export const creditTransactionRelations = relations(
  creditTransactionTable,
  ({ one }) => ({
    user: one(userTable, {
      fields: [creditTransactionTable.userId],
      references: [userTable.id],
    }),
  }),
);

export const purchasedItemsRelations = relations(purchasedItemsTable, ({ one }) => ({
  user: one(userTable, {
    fields: [purchasedItemsTable.userId],
    references: [userTable.id],
  }),
}));

export const userRelations = relations(userTable, ({ many, one }) => ({
  passkeys: many(passKeyCredentialTable),
  creditTransactions: many(creditTransactionTable),
  purchasedItems: many(purchasedItemsTable),
  referralInvitationsSent: many(referralInvitationTable),
  invitedBy: one(userTable, {
    fields: [userTable.referralUserId],
    references: [userTable.id],
  }),
}));

export const passKeyCredentialRelations = relations(
  passKeyCredentialTable,
  ({ one }) => ({
    user: one(userTable, {
      fields: [passKeyCredentialTable.userId],
      references: [userTable.id],
    }),
  }),
);

// ---------- Types ----------
export type User = InferSelectModel<typeof userTable>;
export type PassKeyCredential = InferSelectModel<typeof passKeyCredentialTable>;
export type CreditTransaction = InferSelectModel<typeof creditTransactionTable>;
export type PurchasedItem = InferSelectModel<typeof purchasedItemsTable>;
export type ReferralInvitation = InferSelectModel<typeof referralInvitationTable>;
export type AppSetting = InferSelectModel<typeof appSettingTable>;
