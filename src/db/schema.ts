import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import { type InferSelectModel } from "drizzle-orm";

import { createId } from '@paralleldrive/cuid2'

/**
 * Role definitions for application users.  Only two roles are supported: an
 * administrator with full privileges and a regular user.  The ADMIN role is
 * intended for the site operator, while USER represents all standard
 * customers.  Removing the team functionality means there is no longer a
 * concept of team owners or members.
 */
export const ROLES_ENUM = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

const roleTuple = Object.values(ROLES_ENUM) as [string, ...string[]];

// Common columns shared across all tables to track creation and update
// timestamps.  The updateCounter auto‑increments on each modification.
const commonColumns = {
  createdAt: integer({
    mode: "timestamp",
  }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer({
    mode: "timestamp",
  }).$onUpdateFn(() => new Date()).notNull(),
  updateCounter: integer().default(0).$onUpdate(() => sql`updateCounter + 1`),
}

/**
 * Primary user table.  In addition to basic profile fields, each user has a
 * role (ADMIN or USER), a credit balance and a reference to the inviter
 * (referralUserId) if the user was created via a referral link.  The
 * referralUserId is optional and points back to this same table.
 */
// Type annotation of `any` is used here to avoid a circular type inference error
// when the table references itself. See discussion here:
// https://github.com/drizzle-team/drizzle-orm/discussions/298
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const userTable: any = sqliteTable("user", {
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
  /**
   * This can either be an absolute or relative path to an image
   */
  avatar: text({ length: 600 }),
  // Credit system fields
  currentCredits: integer().default(0).notNull(),
  lastCreditRefreshAt: integer({ mode: "timestamp" }),
  /**
   * Optional reference to the user who invited this user (referral).  When a
   * user signs up via a referral link, this field is set to the inviter's
   * user ID.  It remains null for users who signed up directly.
   */
  /**
   * Optional reference to the user who invited this user (referral).
   * When a user signs up via a referral link, this field is set to the
   * inviter's user ID.  It remains null for users who signed up directly.
   *
   * Note: We intentionally omit a foreign key constraint here to avoid a
   * circular type error in TypeScript when referencing userTable within
   * its own initializer. Instead, we maintain referential integrity at
   * the application level and still index this column for efficient lookups.
   */
  referralUserId: text(),
}, (table) => ([
  index('email_idx').on(table.email),
  index('google_account_id_idx').on(table.googleAccountId),
  index('role_idx').on(table.role),
  index('referral_user_id_idx').on(table.referralUserId),
]));

/**
 * Table for storing passkey credentials (WebAuthn).  Unchanged from the
 * original implementation.
 */
export const passKeyCredentialTable = sqliteTable("passkey_credential", {
  ...commonColumns,
  id: text().primaryKey().$defaultFn(() => `pkey_${createId()}`).notNull(),
  userId: text().notNull().references(() => userTable.id),
  credentialId: text({ length: 255 }).notNull().unique(),
  credentialPublicKey: text({ length: 255 }).notNull(),
  counter: integer().notNull(),
  // Optional array of AuthenticatorTransport as JSON string
  transports: text({ length: 255 }),
  // Authenticator Attestation GUID. We use this to identify the device/authenticator app that created the passkey
  aaguid: text({ length: 255 }),
  // The user agent of the device that created the passkey
  userAgent: text({ length: 255 }),
  // The IP address that created the passkey
  ipAddress: text({ length: 100 }),
}, (table) => ([
  index('user_id_idx').on(table.userId),
  index('credential_id_idx').on(table.credentialId),
]));

// Credit transaction types remain identical to the original implementation.
export const CREDIT_TRANSACTION_TYPE = {
  PURCHASE: 'PURCHASE',
  USAGE: 'USAGE',
  MONTHLY_REFRESH: 'MONTHLY_REFRESH',
} as const;

export const creditTransactionTypeTuple = Object.values(CREDIT_TRANSACTION_TYPE) as [string, ...string[]];

export const creditTransactionTable = sqliteTable("credit_transaction", {
  ...commonColumns,
  id: text().primaryKey().$defaultFn(() => `ctxn_${createId()}`).notNull(),
  userId: text().notNull().references(() => userTable.id),
  amount: integer().notNull(),
  // Track how many credits are still available from this transaction
  remainingAmount: integer().default(0).notNull(),
  type: text({ enum: creditTransactionTypeTuple }).notNull(),
  description: text({ length: 255 }).notNull(),
  expirationDate: integer({ mode: "timestamp" }),
  expirationDateProcessedAt: integer({ mode: "timestamp" }),
  paymentIntentId: text({ length: 255 }),
}, (table) => ([
  index('credit_transaction_user_id_idx').on(table.userId),
  index('credit_transaction_type_idx').on(table.type),
  index('credit_transaction_created_at_idx').on(table.createdAt),
  index('credit_transaction_expiration_date_idx').on(table.expirationDate),
  index('credit_transaction_payment_intent_id_idx').on(table.paymentIntentId),
]));

// Define item types that can be purchased
export const PURCHASABLE_ITEM_TYPE = {
  COMPONENT: 'COMPONENT',
  // Add more types in the future (e.g., TEMPLATE, PLUGIN, etc.)
} as const;

export const purchasableItemTypeTuple = Object.values(PURCHASABLE_ITEM_TYPE) as [string, ...string[]];

export const purchasedItemsTable = sqliteTable("purchased_item", {
  ...commonColumns,
  id: text().primaryKey().$defaultFn(() => `pitem_${createId()}`).notNull(),
  userId: text().notNull().references(() => userTable.id),
  // The type of item (e.g., COMPONENT, TEMPLATE, etc.)
  itemType: text({ enum: purchasableItemTypeTuple }).notNull(),
  // The ID of the item within its type (e.g., componentId)
  itemId: text().notNull(),
  purchasedAt: integer({ mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, (table) => ([
  index('purchased_item_user_id_idx').on(table.userId),
  index('purchased_item_type_idx').on(table.itemType),
  // Composite index for checking if a user owns a specific item of a specific type
  index('purchased_item_user_item_idx').on(table.userId, table.itemType, table.itemId),
]));

/**
 * Referral invitation table.  Each invitation contains a unique token that
 * identifies the invite.  When a user invites someone via e‑mail, a row is
 * created in this table.  Once the invite is accepted, the status is
 * updated and bonus credits can be applied to both the inviter and the new
 * user.  The table also allows specifying an expiration time.
 */
export const REFERRAL_INVITATION_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
} as const;

export const referralInvitationStatusTuple = Object.values(REFERRAL_INVITATION_STATUS) as [string, ...string[]];

export const referralInvitationTable = sqliteTable("referral_invitation", {
  ...commonColumns,
  id: text().primaryKey().$defaultFn(() => `rinv_${createId()}`).notNull(),
  // Unique token used in the referral link
  token: text({ length: 255 }).notNull().unique(),
  // User who initiated the referral
  inviterUserId: text().notNull().references(() => userTable.id),
  // E‑mail address of the person being invited
  invitedEmail: text({ length: 255 }).notNull(),
  // Current status of the referral
  status: text({ enum: referralInvitationStatusTuple }).default(REFERRAL_INVITATION_STATUS.PENDING).notNull(),
  // When does this invitation expire
  expiresAt: integer({ mode: "timestamp" }),
  // Credits awarded to the inviter when the invite is accepted
  creditsAwarded: integer().default(0).notNull(),
}, (table) => ([
  index('referral_invitation_inviter_idx').on(table.inviterUserId),
  index('referral_invitation_email_idx').on(table.invitedEmail),
  index('referral_invitation_token_idx').on(table.token),
]));

// Relations
export const creditTransactionRelations = relations(creditTransactionTable, ({ one }) => ({
  user: one(userTable, {
    fields: [creditTransactionTable.userId],
    references: [userTable.id],
  }),
}));

export const purchasedItemsRelations = relations(purchasedItemsTable, ({ one }) => ({
  user: one(userTable, {
    fields: [purchasedItemsTable.userId],
    references: [userTable.id],
  }),
}));

// A user can have many passkeys, credit transactions, purchased items, and referral invitations
export const userRelations = relations(userTable, ({ many, one }) => ({
  passkeys: many(passKeyCredentialTable),
  creditTransactions: many(creditTransactionTable),
  purchasedItems: many(purchasedItemsTable),
  // A user may have sent many referral invitations. The foreign key is defined
  // on referralInvitationTable.inviterUserId, so we don't need to specify
  // fields and references here.
  referralInvitationsSent: many(referralInvitationTable),
  // Link back to the user who invited this user
  invitedBy: one(userTable, {
    fields: [userTable.referralUserId],
    references: [userTable.id],
  }),
}));

export const passKeyCredentialRelations = relations(passKeyCredentialTable, ({ one }) => ({
  user: one(userTable, {
    fields: [passKeyCredentialTable.userId],
    references: [userTable.id],
  }),
}));

export type User = InferSelectModel<typeof userTable>;
export type PassKeyCredential = InferSelectModel<typeof passKeyCredentialTable>;
export type CreditTransaction = InferSelectModel<typeof creditTransactionTable>;
export type PurchasedItem = InferSelectModel<typeof purchasedItemsTable>;
export type ReferralInvitation = InferSelectModel<typeof referralInvitationTable>;