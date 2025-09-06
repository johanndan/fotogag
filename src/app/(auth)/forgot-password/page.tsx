// /src/app/(auth)/forgot-password/page.tsx
import { Metadata } from "next";
import ForgotPasswordClientComponent from "./forgot-password.client";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your password",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClientComponent />;
}
