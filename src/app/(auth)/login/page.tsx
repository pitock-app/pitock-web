import type { Metadata } from "next";
import { LoginForm } from "@/features/auth";
import { isMockMode } from "@/lib/env";
import { it } from "@/lib/i18n/it";

export const metadata: Metadata = { title: it.pages.login.title };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : undefined} mockMode={isMockMode} />;
}
