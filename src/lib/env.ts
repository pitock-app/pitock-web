import { z } from "zod";

/**
 * Variabili d'ambiente pubbliche, validate con Zod.
 * Il frontend non ha segreti: tutte le variabili sono NEXT_PUBLIC_* e finiscono nel bundle.
 * Vanno lette in modo esplicito (non con process.env dinamico) perché Next le sostituisce in build.
 */
const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url().default("http://localhost:8787"),
  NEXT_PUBLIC_SUPABASE_URL: z.union([z.url(), z.literal("")]).default(""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default(""),
  NEXT_PUBLIC_API_MOCKING: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  /** Variabile di sistema di Vercel (esposta automaticamente): non la impostiamo noi. */
  NEXT_PUBLIC_VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
});

export type Env = z.infer<typeof envSchema>;

type RawEnv = Partial<Record<keyof z.input<typeof envSchema>, string | undefined>>;

/** Svuota le stringhe vuote così che valgano i default. */
function withoutEmpty(raw: RawEnv): RawEnv {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, value === "" ? undefined : value]),
  ) as RawEnv;
}

export function parseEnv(raw: RawEnv): Env {
  const result = envSchema.safeParse(withoutEmpty(raw));
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Variabili d'ambiente non valide: ${details}`);
  }
  return result.data;
}

export const env: Env = parseEnv({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_API_MOCKING: process.env.NEXT_PUBLIC_API_MOCKING,
  NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
});

/**
 * Modalità mock (MSW, auth e Storage finti). Mai in produzione su Vercel, anche se
 * NEXT_PUBLIC_API_MOCKING restasse acceso per errore: `next.config.ts` blocca la build
 * di produzione con il mock attivo, e qui NEXT_PUBLIC_VERCEL_ENV (variabile di sistema
 * di Vercel, esposta al browser) lo spegne comunque.
 */
export const isMockMode: boolean =
  env.NEXT_PUBLIC_API_MOCKING && env.NEXT_PUBLIC_VERCEL_ENV !== "production";
