import type { Route } from "next"

// ──────────────────────────────────────────────────────────────
// Site / branding
// ──────────────────────────────────────────────────────────────
export const SITE_NAME = "PhotoGag"
export const SITE_DESCRIPTION = "AI-powered photo and meme tools."
export const SITE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://photogag.ai"

export const SITE_DOMAIN = new URL(SITE_URL).hostname

// ──────────────────────────────────────────────────────────────
// Auth / email tokens
// ──────────────────────────────────────────────────────────────
export const PASSWORD_RESET_TOKEN_EXPIRATION_SECONDS = 24 * 60 * 60 // 24 hours
export const EMAIL_VERIFICATION_TOKEN_EXPIRATION_SECONDS = 24 * 60 * 60 // 24 hours

// ──────────────────────────────────────────────────────────────
// Sessions
// ──────────────────────────────────────────────────────────────
export const MAX_SESSIONS_PER_USER = 5

// Cookie names
export const SESSION_COOKIE_NAME = "session"
export const GOOGLE_OAUTH_STATE_COOKIE_NAME = "google-oauth-state"
export const GOOGLE_OAUTH_CODE_VERIFIER_COOKIE_NAME = "google-oauth-code-verifier"

// ──────────────────────────────────────────────────────────────
// Credits / marketplace
// ──────────────────────────────────────────────────────────────
export const CREDIT_PACKAGES = [
  { id: "package-1", credits: 500, price: 5 },
  { id: "package-2", credits: 1200, price: 10 },
  { id: "package-3", credits: 3000, price: 20 },
] as const

export const CREDITS_EXPIRATION_YEARS = 2

// Free monthly credits given to every user as a percentage of the smallest package
export const FREE_MONTHLY_CREDITS = CREDIT_PACKAGES[0].credits * 0.1

// Pagination limit for credit transactions
export const MAX_TRANSACTIONS_PER_PAGE = 10

// Default redirect after a successful sign in
export const REDIRECT_AFTER_SIGN_IN = "/dashboard" as Route

// ──────────────────────────────────────────────────────────────
// Referral program
// ──────────────────────────────────────────────────────────────
/**
 * When a user invites another user via e-mail and the invitation is accepted,
 * the inviter receives REFERRAL_CREDITS and the new user receives INVITEE_CREDITS.
 */
export const REFERRAL_CREDITS = 60
export const INVITEE_CREDITS = 50
