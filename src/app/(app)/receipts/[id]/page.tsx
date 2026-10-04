import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ReceiptDetailView } from "@/features/receipts";
import { it } from "@/lib/i18n/it";

export const metadata: Metadata = { title: it.pages.receipt.title };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const receiptId = z.uuid();

export default async function Page({ params, searchParams }: PageProps) {
  const { id } = await params;
  // Solo UUID: un id come ".." cambierebbe il percorso delle chiamate API.
  if (!receiptId.safeParse(id).success) notFound();
  const { edit } = await searchParams;
  return <ReceiptDetailView id={id} edit={edit === "1"} />;
}
