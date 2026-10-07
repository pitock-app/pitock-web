"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { getAuthProvider } from "@/lib/auth";
import { it } from "@/lib/i18n/it";
import { registerSchema, type RegisterValues } from "./auth.schema";
import { authErrorMessage } from "./auth-error-message";
import { AuthCard } from "./AuthCard";
import { FormField } from "./FormField";

const t = it.auth;

export function RegisterForm({ mockMode = false }: { mockMode?: boolean }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  // Resta true fino al cambio di pagina, così il pulsante non si riattiva.
  const [redirecting, setRedirecting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const confirmationRef = useRef<HTMLParagraphElement>(null);

  // Il form sparisce: il focus va al messaggio, che così viene anche letto.
  useEffect(() => {
    if (confirmationSent) confirmationRef.current?.focus();
  }, [confirmationSent]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", passwordConfirm: "" } as Partial<RegisterValues>,
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      const { needsEmailConfirmation } = await getAuthProvider().signUp(email, password, {
        // Prova del consenso (art. 7 GDPR): testo accettato e momento.
        consent_at: new Date().toISOString(),
        consent_version: "2026-10",
      });
      if (needsEmailConfirmation) {
        setConfirmationSent(true);
        return;
      }
      setRedirecting(true);
      router.replace("/onboarding");
      router.refresh();
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  });

  return (
    <AuthCard
      title={t.registerTitle}
      description={t.registerDescription}
      footer={
        <>
          {t.haveAccount}{" "}
          <Link href="/login" className="text-foreground font-medium underline underline-offset-4">
            {t.goToLogin}
          </Link>
        </>
      }
    >
      {mockMode && (
        <p className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm">
          {t.mockNotice}
        </p>
      )}
      {confirmationSent ? (
        <p
          ref={confirmationRef}
          role="status"
          tabIndex={-1}
          className="focus-visible:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
        >
          {t.checkEmail}
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormField
            id="email"
            label={t.email}
            type="email"
            autoComplete="email"
            inputMode="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <FormField
            id="password"
            label={t.password}
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <FormField
            id="passwordConfirm"
            label={t.passwordConfirm}
            type="password"
            autoComplete="new-password"
            error={errors.passwordConfirm?.message}
            {...register("passwordConfirm")}
          />
          {(["terms", "health"] as const).map((name) => (
            <div key={name} className="flex flex-col gap-1 text-sm">
              <label className="flex gap-2">
                <input type="checkbox" className="mt-1" {...register(name)} />
                <span>
                  {t[name]}{" "}
                  <Link href="/legal" target="_blank" className="underline underline-offset-4">
                    {t.legal}
                  </Link>
                </span>
              </label>
              {errors[name] && <p className="text-destructive">{errors[name].message}</p>}
            </div>
          ))}
          {formError && (
            <p role="alert" className="text-destructive text-sm">
              {formError}
            </p>
          )}
          <Button type="submit" size="lg" className="h-11" disabled={isSubmitting || redirecting}>
            {isSubmitting || redirecting ? t.registering : t.register}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
