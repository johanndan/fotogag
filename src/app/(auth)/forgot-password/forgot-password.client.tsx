// src/app/(auth)/forgot-password/forgot-password.client.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { forgotPasswordAction } from "./forgot-password.action";
import { useServerAction } from "zsa-react";
import { toast } from "sonner";
import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { useSessionStore } from "@/state/session";
import { Captcha } from "@/components/captcha";
import { forgotPasswordSchema } from "@/schemas/forgot-password.schema";
import { useConfigStore } from "@/state/config";

type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordClientComponent() {
  const { session } = useSessionStore();
  const { isTurnstileEnabled } = useConfigStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const emailFromQuery = searchParams.get("email") ?? "";
  const prefillEmail = session?.user?.email || emailFromQuery || "";
  const hasPrefilledEmail = prefillEmail.length > 0;
  const isLoggedIn = Boolean(session?.user?.email);

  // Captcha nur für AUSGELOGGTE Nutzer verlangen
  const isCaptchaRequired = Boolean(isTurnstileEnabled && !isLoggedIn);

  // Bedingtes Schema: mit Captcha (ausgeloggt) / ohne Captcha (eingeloggt)
  const effectiveSchema = useMemo(() => {
    return isCaptchaRequired
      ? forgotPasswordSchema
      : forgotPasswordSchema.extend({
          captchaToken: z.string().optional().or(z.literal("")),
        });
  }, [isCaptchaRequired]);

  const form = useForm<ForgotPasswordSchema>({
    resolver: zodResolver(effectiveSchema),
    defaultValues: {
      email: prefillEmail,
      captchaToken: "",
    },
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  // E-Mail im Formular synchron halten
  useEffect(() => {
    const nextEmail = session?.user?.email || (searchParams.get("email") ?? "");
    if (nextEmail !== form.getValues("email")) {
      form.setValue("email", nextEmail);
    }
  }, [session?.user?.email, searchParams, form]);

  // RHF-Tracking vom Captcha
  const captchaToken = useWatch({ control: form.control, name: "captchaToken" });

  const { execute: sendResetLink, isSuccess } = useServerAction(forgotPasswordAction, {
    onError: (error) => {
      toast.dismiss();
      toast.error(error.err?.message ?? "Failed to send reset instructions");
    },
    onStart: () => {
      toast.loading("Sending reset instructions...");
    },
    onSuccess: () => {
      toast.dismiss();
      toast.success("Reset instructions sent");
    },
  });

  const onSubmit = async (data: ForgotPasswordSchema) => {
    // Email absichern (falls Nutzer das Feld leert)
    if (!data.email && prefillEmail) {
      data.email = prefillEmail;
    }
    // Captcha nur mitsenden, wenn wirklich erforderlich
    if (!isCaptchaRequired) {
      data.captchaToken = "";
    }
    sendResetLink(data);
  };

  if (isSuccess) {
    return (
      <div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              If an account exists with that email, we&apos;ve sent you instructions to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => router.push("/sign-in")}>
              Back to login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const disableSubmit =
    form.formState.isSubmitting || (isCaptchaRequired && !captchaToken);

  return (
    <div className="container mx-auto px-4 flex flex-col items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isLoggedIn ? "Change Password" : "Forgot Password"}</CardTitle>
          <CardDescription>
            Enter your email address and we&apos;ll send you instructions to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        className="w-full px-3 py-2"
                        placeholder="name@example.com"
                        {...field}
                        readOnly={hasPrefilledEmail} // nicht disabled!
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Hidden-Registration für captchaToken, damit RHF/Resolver das Feld kennt */}
              <input type="hidden" {...form.register("captchaToken")} />

              {/* Captcha nur rendern, wenn erforderlich */}
              {isCaptchaRequired && (
                <div className="flex flex-col justify-center items-center">
                  <Captcha
                    onSuccess={(token) => form.setValue("captchaToken", token)}
                    validationError={form.formState.errors.captchaToken?.message}
                  />
                </div>
              )}

              <div className="flex flex-col justify-center items-center">
                <Button type="submit" className="mt-8 mb-2" disabled={disableSubmit}>
                  Send Reset Instructions
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="mt-4 w-full">
        {isLoggedIn ? (
          <Button type="button" variant="link" className="w-full" onClick={() => router.push("/settings")}>
            Back to settings
          </Button>
        ) : (
          <Button type="button" variant="link" className="w-full" onClick={() => router.push("/sign-in")}>
            Back to login
          </Button>
        )}
      </div>
    </div>
  );
}
