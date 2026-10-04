"use client";

import { RefreshCw } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Field, NativeSelect } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAiModels } from "@/features/settings";
import { aiProviders } from "@/lib/api/enums";
import { apiErrorMessage, isApiError } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { it } from "@/lib/i18n/it";
import { useReextract } from "./hooks/useReceipt";

type ReextractInput = components["schemas"]["ReextractInput"];
type Provider = components["schemas"]["Provider"];

const t = it.receipt.reextract;
const MAX_MODEL = 200;

/** "Rilancia estrazione" con scelta facoltativa di provider e modello. */
export function ReextractDialog({
  receiptId,
  disabled,
  describedBy,
}: {
  receiptId: string;
  disabled?: boolean;
  /** Id del testo che spiega perché l'azione non è disponibile. */
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider | "">("");
  const [model, setModel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reextract = useReextract();
  // Suggerimenti dai modelli del provider (se c'è una chiave salvata); l'ID resta libero.
  const models = useAiModels(provider || null, open && provider !== "");
  const suggestions = models.data?.models ?? [];

  const modelError = model.trim().length > MAX_MODEL ? t.modelTooLong : undefined;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setProvider("");
      setModel("");
      setError(null);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (modelError) return;
    setError(null);
    const body: ReextractInput = {
      ...(provider ? { provider } : {}),
      ...(model.trim() ? { model: model.trim() } : {}),
    };
    try {
      await reextract.mutateAsync({ id: receiptId, body });
      setOpen(false);
      toast.success(t.started);
    } catch (err) {
      setError(isApiError(err) ? err.message : apiErrorMessage("UNKNOWN"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="h-11"
            disabled={disabled}
            // Resta raggiungibile da tastiera: il focus torna qui anche quando si disattiva.
            focusableWhenDisabled
            aria-describedby={disabled ? describedBy : undefined}
          />
        }
      >
        <RefreshCw aria-hidden />
        {it.receipt.actions.reextract}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
            <DialogDescription>{t.description}</DialogDescription>
          </DialogHeader>
          <Field id="reextract-provider" label={t.provider}>
            {(control) => (
              <NativeSelect
                {...control}
                value={provider}
                onChange={(event) =>
                  setProvider(
                    (aiProviders as readonly string[]).includes(event.target.value)
                      ? (event.target.value as Provider)
                      : "",
                  )
                }
              >
                <option value="">{t.providerDefault}</option>
                {aiProviders.map((value) => (
                  <option key={value} value={value}>
                    {it.aiProviders[value]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field
            id="reextract-model"
            label={t.model}
            labelSuffix={it.manualEntry.optional}
            hint={t.modelHint}
            error={modelError}
          >
            {(control) => (
              <Input
                {...control}
                value={model}
                autoComplete="off"
                spellCheck={false}
                className="h-11"
                list={suggestions.length > 0 ? "reextract-model-options" : undefined}
                onChange={(event) => setModel(event.target.value)}
              />
            )}
          </Field>
          {suggestions.length > 0 && (
            <datalist id="reextract-model-options">
              {suggestions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </datalist>
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" className="h-11" />}>
              {t.cancel}
            </DialogClose>
            <Button
              type="submit"
              className="bg-brand text-brand-foreground hover:bg-brand/90 h-11"
              disabled={reextract.isPending}
            >
              {reextract.isPending ? t.submitting : t.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
