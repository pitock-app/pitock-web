"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { getAuthProvider, safeRedirectPath } from "@/lib/auth";
import { it } from "@/lib/i18n/it";
import { loginSchema, type LoginValues } from "./auth.schema";
import { authErrorMessage } from "./auth-error-message";
import { AuthCard } from "./AuthCard";
import { FormField } from "./FormField";

const t = it.auth;

type LoginFormProps = {
  /** Pagina da aprire dopo il login (parametro `next`). */
  next?: string;
  /** Mostra l'avviso della modalità demo. */
  mockMode?: boolean;
};

export function LoginForm({ next, mockMode = false }: LoginFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  // Resta true fino al cambio di pagina, così il pulsante non si riattiva.
  const [redirecting, setRedirecting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      await getAuthProvider().signIn(email, password);
      setRedirecting(true);
      router.replace(safeRedirectPath(next));
      router.refresh();
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  });

  return (
    <AuthCard
      title={t.loginTitle}
      description={t.loginDescription}
      footer={
        <>
          {t.noAccount}{" "}
          <Link
            href="/register"
            className="text-foreground font-medium underline underline-offset-4"
          >
            {t.goToRegister}
          </Link>
        </>
      }
    >
      {mockMode && (
        <p className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm">
          {t.mockNotice}
        </p>
      )}
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        {formError && (
          <p role="alert" className="text-destructive text-sm">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" className="h-11" disabled={isSubmitting || redirecting}>
          {isSubmitting || redirecting ? t.loggingIn : t.login}
        </Button>
      </form>
    </AuthCard>
  );
}
