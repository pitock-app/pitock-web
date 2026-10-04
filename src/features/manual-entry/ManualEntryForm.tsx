"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Calculator, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiErrorMessage, isApiError } from "@/lib/api/errors";
import { formatAmountInput, toRomeLocalInput } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useCreateManualReceipt } from "./hooks/useCreateManualReceipt";
import { ItemsFieldArray } from "./ItemsFieldArray";
import {
  defaultManualEntryValues,
  manualEntrySchema,
  toManualReceiptInput,
  totalFromItems,
  type ManualEntryOutput,
  type ManualEntryValues,
} from "./manual-entry.schema";
import { ReceiptFields } from "./ReceiptFields";

const t = it.manualEntry;

/** Form dell'inserimento manuale: salva con `POST /v1/receipts/manual`. */
export function ManualEntryForm() {
  const router = useRouter();
  const [savedId, setSavedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const createReceipt = useCreateManualReceipt();
  const form = useForm<ManualEntryValues, unknown, ManualEntryOutput>({
    resolver: zodResolver(manualEntrySchema),
    defaultValues: defaultManualEntryValues(toRomeLocalInput()),
  });
  const { handleSubmit, getValues, setValue, reset, formState } = form;

  const computeTotal = () => {
    const total = totalFromItems(getValues("items"));
    if (total === null) {
      toast.info(t.computeTotalEmpty);
      return;
    }
    setValue("total", formatAmountInput(total), { shouldValidate: true, shouldDirty: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSavedId(null);
    try {
      const detail = await createReceipt.mutateAsync(toManualReceiptInput(values));
      const id = detail.receipt.id;
      reset(defaultManualEntryValues(toRomeLocalInput()));
      setSavedId(id);
      toast.success(t.saved, {
        action: { label: t.openReceipt, onClick: () => router.push(routes.receipt(id)) },
      });
    } catch (error) {
      setFormError(isApiError(error) ? error.message : apiErrorMessage("UNKNOWN"));
    }
  });

  return (
    <FormProvider {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        aria-label={t.title}
        className="flex flex-col gap-6"
        onChange={() => savedId && setSavedId(null)}
      >
        <ReceiptFields idPrefix="manual" />
        <ItemsFieldArray idPrefix="manual" />

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" className="h-11" onClick={computeTotal}>
            <Calculator aria-hidden />
            {t.computeTotal}
          </Button>
          <Button
            type="submit"
            className="bg-brand text-brand-foreground hover:bg-brand/90 h-11 px-6"
            disabled={formState.isSubmitting}
          >
            {formState.isSubmitting ? t.saving : t.save}
          </Button>
        </div>

        <div className="empty:hidden">
          {formError && (
            <p role="alert" className="text-destructive text-sm">
              {formError}
            </p>
          )}
          {savedId && (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <CheckCircle2 className="text-brand size-4" aria-hidden />
              {t.saved}
              <Link
                href={routes.receipt(savedId)}
                className={cn(buttonVariants({ variant: "outline" }), "h-11")}
              >
                {t.openReceipt}
              </Link>
            </p>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
