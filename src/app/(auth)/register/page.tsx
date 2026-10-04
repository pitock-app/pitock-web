import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth";
import { isMockMode } from "@/lib/env";
import { it } from "@/lib/i18n/it";

export const metadata: Metadata = { title: it.pages.register.title };

export default function Page() {
  return <RegisterForm mockMode={isMockMode} />;
}
