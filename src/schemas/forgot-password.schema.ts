// src/schemas/forgot-password.schema.ts
import { z } from "zod";

// Basis-Schema: Captcha optional (eingeloggt / interner Flow)
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address"),
  // Wichtig: optional + Default, damit Zod nicht blockiert
  captchaToken: z.string().optional().default(""),
});

// Optional: Öffentliches Schema, falls du im Guest-Flow hart erzwingen willst
export const forgotPasswordPublicSchema = forgotPasswordSchema.extend({
  captchaToken: z.string().min(1, "Please complete the captcha"),
});

export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;
