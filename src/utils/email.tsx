// src/utils/email.tsx
import "server-only";
import * as React from "react";
import { render } from "@react-email/render";
import { SITE_DOMAIN, SITE_URL, SITE_NAME } from "@/constants";
import { ResetPasswordEmail } from "@/react-email/reset-password";
import { VerifyEmail } from "@/react-email/verify-email";
import ReferralInviteEmail from "@/react-email/referral-invite";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import isProd from "./is-prod";

// ✅ fehlende Imports ergänzt
import { getDB } from "@/db";
import { appSettingTable } from "@/db/schema";
import { eq } from "drizzle-orm";

function envVar(name: string): string | undefined {
  try {
    const { env } = getCloudflareContext();
    // @ts-expect-error index access ok
    const fromEnv = env?.[name];
    if (fromEnv && typeof fromEnv === "string") return fromEnv;
  } catch {}
  return process.env?.[name];
}

/* kritisch: "From" auf Apex-Domain normalisieren */
function apexHost(): string {
  const fromSiteUrl = (() => {
    try { return new URL(SITE_URL).hostname; } catch { return undefined; }
  })();
  const base = (fromSiteUrl || SITE_DOMAIN || "photogag.ai").trim();
  return base.replace(/^https?:\/\//, "").replace(/^www\./, "");
}

function normalizeFrom(raw: string): string {
  const host = apexHost();
  const trimmed = raw.trim();
  // Formate: "Name <user@domain>" | "user@domain"
  const m = trimmed.match(/^(.*?<)?([^<@]+)@([^>]+?)(>?$)/);
  if (!m) return trimmed.includes("@") ? trimmed : `no-reply@${host}`;

  const prefix = m[1] ?? "";   // evtl. "PhotoGag <"
  const local  = m[2];         // "no-reply"
  const suffix = m[4] ?? "";   // ">"
  return `${prefix}${local}@${host}${suffix}`;
}

/* From zusammenbauen (ENV > Fallback), immer apex-normalisiert */
function buildFromHeader(): string {
  const configured = envVar("EMAIL_FROM");
  const name = envVar("EMAIL_FROM_NAME");
  if (configured?.includes("<") && configured.includes(">")) return normalizeFrom(configured);
  if (configured && name) return normalizeFrom(`${name} <${configured}>`);
  if (configured) return normalizeFrom(configured);
  throw new Error("EMAIL_FROM is not configured correctly.");
}

function buildReplyToHeader(override?: string): string | undefined {
  if (override) return override;
  const reply = envVar("EMAIL_REPLY_TO");
  return reply || undefined;
}

/** === Typen === */
interface BrevoEmailOptions {
  to: { email: string; name?: string }[];
  subject: string;
  replyTo?: string;
  htmlContent: string;
  textContent?: string;
  templateId?: number;
  params?: Record<string, string>;
  tags?: string[];
}

interface ResendEmailOptions {
  to: string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  text?: string;
  tags?: { name: string; value: string }[];
}

type EmailProvider = "resend" | "brevo" | null;

async function getEmailProvider(): Promise<EmailProvider> {
  if (envVar("RESEND_API_KEY")) return "resend";
  if (envVar("BREVO_API_KEY")) return "brevo";
  return null;
}

/** === Resend === */
async function sendResendEmail({
  to,
  subject,
  html,
  from,
  replyTo: originalReplyTo,
  text,
  tags,
}: ResendEmailOptions) {
  if (!isProd) return;

  const apiKey = envVar("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY is not set (Cloudflare secret missing).");

  const replyTo = buildReplyToHeader(originalReplyTo);
  const fromHeader = normalizeFrom(from ?? buildFromHeader()); // ← Apex erzwingen (z. B. @photogag.ai)

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromHeader,                 // Resend: "Your Name <sender@domain>"
      to,
      subject,
      html,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
      tags,
    }),
  });

  if (!res.ok) {
    let details: unknown = {};
    try { details = await res.json(); } catch {}
    throw new Error(`Failed to send email via Resend (status ${res.status}): ${JSON.stringify(details)}`);
  }
  return res.json();
}

/** === Brevo === */
async function sendBrevoEmail({
  to,
  subject,
  replyTo: originalReplyTo,
  htmlContent,
  textContent,
  templateId,
  params,
  tags,
}: BrevoEmailOptions) {
  if (!isProd) return;

  const apiKey = envVar("BREVO_API_KEY");
  if (!apiKey) throw new Error("BREVO_API_KEY is not set (Cloudflare secret missing).");

  const replyTo = buildReplyToHeader(originalReplyTo);
  const fromEmail = normalizeFrom(envVar("EMAIL_FROM") ?? "no-reply@" + apexHost());
  const fromName = envVar("EMAIL_FROM_NAME");

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail.replace(/.*</, "").replace(/>/g, "") },
      to,
      htmlContent,
      textContent,
      subject,
      templateId,
      params,
      tags,
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
    }),
  });

  if (!res.ok) {
    let details: unknown = {};
    try { details = await res.json(); } catch {}
    throw new Error(`Failed to send email via Brevo (status ${res.status}): ${JSON.stringify(details)}`);
  }
  return res.json();
}

/** === Password Reset === */
export async function sendPasswordResetEmail({
  email,
  resetToken,
  username,
}: {
  email: string;
  resetToken: string;
  username: string;
}) {
  const resetUrl = `${SITE_URL}/reset-password?token=${resetToken}`;
  if (!isProd) { console.warn("Password reset url:", resetUrl); return; }

  const html = await render(ResetPasswordEmail({ resetLink: resetUrl, username }));
  const provider = await getEmailProvider();
  if (!provider) throw new Error("No email provider configured. Set RESEND_API_KEY or BREVO_API_KEY.");

  if (provider === "resend") {
    await sendResendEmail({
      to: [email],
      subject: `Reset your password for ${SITE_DOMAIN}`,
      html,
      tags: [{ name: "type", value: "password-reset" }],
    });
  } else {
    await sendBrevoEmail({
      to: [{ email, name: username }],
      subject: `Reset your password for ${SITE_DOMAIN}`,
      htmlContent: html,
      tags: ["password-reset"],
    });
  }
}

/** === Email Verification === */
export async function sendVerificationEmail({
  email,
  verificationToken,
  username,
}: {
  email: string;
  verificationToken: string;
  username: string;
}) {
  const verificationUrl = `${SITE_URL}/verify-email?token=${verificationToken}`;
  if (!isProd) { console.warn("Verification url:", verificationUrl); return; }

  const html = await render(VerifyEmail({ verificationLink: verificationUrl, username }));
  const provider = await getEmailProvider();
  if (!provider) throw new Error("No email provider configured. Set RESEND_API_KEY or BREVO_API_KEY.");

  if (provider === "resend") {
    await sendResendEmail({
      to: [email],
      subject: `Verify your email for ${SITE_DOMAIN}`,
      html,
      tags: [{ name: "type", value: "email-verification" }],
    });
  } else {
    await sendBrevoEmail({
      to: [{ email, name: username }],
      subject: `Verify your email for ${SITE_DOMAIN}`,
      htmlContent: html,
      tags: ["email-verification"],
    });
  }
}

/** === Referral Invite (englische Texte) === */
export async function sendReferralInvitationEmail({
  email,
  invitationToken,
  inviterName,
}: {
  email: string;
  invitationToken: string;
  inviterName?: string;
}) {
  const inviteUrl = `${SITE_URL}/accept-referral?token=${encodeURIComponent(invitationToken)}`;
  if (!isProd) { console.warn("Referral invite url:", inviteUrl); return; }

  // ✅ Settings aus DB lesen (Credits dynamisch)
  const db = getDB();
  const [referralSetting, registrationSetting] = await Promise.all([
    db.query.appSettingTable.findFirst({
      where: eq(appSettingTable.key, "referral_bonus_credits"),
      columns: { value: true },
    }),
    db.query.appSettingTable.findFirst({
      where: eq(appSettingTable.key, "default_registration_credits"),
      columns: { value: true },
    }),
  ]);

  const inviterBonusCredits = Number(referralSetting?.value ?? 0);
  const inviteeCredits = Number(registrationSetting?.value ?? 0);

  const html = await render(
    <ReferralInviteEmail
      invitationToken={invitationToken}
      inviterName={inviterName}
      inviterBonusCredits={inviterBonusCredits}
      inviteeCredits={inviteeCredits}
    />
  );

  const provider = await getEmailProvider();
  if (!provider) throw new Error("No email provider configured. Set RESEND_API_KEY or BREVO_API_KEY.");

  const subject = `You’ve been invited to ${SITE_NAME}`;

  if (provider === "resend") {
    await sendResendEmail({
      to: [email],
      subject,
      html,
      tags: [{ name: "type", value: "referral-invitation" }],
    });
  } else {
    await sendBrevoEmail({
      to: [{ email }],
      subject,
      htmlContent: html,
      tags: ["referral-invitation"],
    });
  }
}
