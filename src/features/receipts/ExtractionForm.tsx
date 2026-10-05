"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Calculator, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ItemsFieldArray, ReceiptFields, totalFromItems } from "@/features/manual-entry";
import { apiErrorMessage, isApiError } from "@/lib/api/errors";
import { itemsTotalMismatch } from "@/lib/extraction";
import { formatAmountInput, formatCurrency, parseItalianNumber } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { useUpdateExtraction } from "./hooks/useReceipt";
import {
  extractionFormSchema,
  extractionToFormValues,
  toExtractionPatch,
  type Extraction,
  type ExtractionFormOutput,
  type ExtractionFormValues,
} from "./lib/extraction-form";

const t = it.receipt.extraction;

type ExtractionFormProps = {
  extraction: Extraction;
  /** Porta il focus sul primo campo (link "Correggi"). */
  autoFocus?: boolean;
};

/** Correzione dell'estrazione corrente con gli stessi campi del form manuale. */
export function ExtractionForm({ extraction, autoFocus }: ExtractionFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const update = useUpdateExtraction();
  const form = useForm<ExtractionFormValues, unknown, ExtractionFormOutput>({
    resolver: zodResolver(extractionFormSchema),
    defaultValues: extractionToFormValues(extraction),
  });
  const { handleSubmit, getValues, setValue, reset, setFocus, formState, control } = form;
  // Si aggiorna mentre l'utente corregge righe e totale.
  const [items, totalText] = useWatch({ control, name: ["items", "total"] });
  const mismatch = itemsTotalMismatch(
    parseItalianNumber(totalText ?? ""),
    totalFromItems(items ?? []),
  );

  useEffect(() => {
    if (autoFocus) setFocus("merchantName");
  }, [autoFocus, setFocus]);

  const computeTotal = () => {
    const total = totalFromItems(getValues("items"));
    if (total === null) {
      toast.info(it.manualEntry.computeTotalEmpty);
      return;
    }
    setValue("total", formatAmountInput(total), { shouldValidate: true, shouldDirty: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const updated = await update.mutateAsync({
        extractionId: extraction.id,
        body: toExtractionPatch(values),
      });
      reset(extractionToFormValues(updated));
      toast.success(t.saved);
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
        data-testid="extraction-form"
      >
        <ReceiptFields idPrefix="extraction" />
        <ItemsFieldArray idPrefix="extraction" />

        {mismatch && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg border border-amber-600/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
            data-testid="items-total-mismatch"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t.itemsTotalMismatch(
              formatCurrency(mismatch.sum),
              formatCurrency(mismatch.total),
              formatCurrency(Math.abs(mismatch.difference)),
            )}
          </p>
        )}
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" className="h-11" onClick={computeTotal}>
            <Calculator aria-hidden />
            {it.manualEntry.computeTotal}
          </Button>
          <Button
            type="submit"
            className="bg-brand text-brand-foreground hover:bg-brand/90 h-11 px-6"
            disabled={formState.isSubmitting}
          >
            <Save aria-hidden />
            {formState.isSubmitting ? t.saving : t.save}
          </Button>
        </div>
        {formError && (
          <p role="alert" className="text-destructive flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            {formError}
          </p>
        )}
      </form>
    </FormProvider>
  );
}
