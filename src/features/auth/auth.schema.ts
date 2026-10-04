import { z } from "zod";
import { it } from "@/lib/i18n/it";

const t = it.auth.errors;

const email = z
  .string()
  .trim()
  .min(1, t.emailInvalid)
  .pipe(z.email({ error: t.emailInvalid }));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, t.passwordRequired),
});

export const registerSchema = z
  .object({
    email,
    password: z.string().min(8, t.passwordTooShort),
    passwordConfirm: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: t.passwordMismatch,
    path: ["passwordConfirm"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
