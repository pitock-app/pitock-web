"use client";

import { CheckCircle2, Eye, EyeOff, KeyRound, Trash2 } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Field } from "@/components/form";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorMessage, isApiError } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { formatDate } from "@/lib/format";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";
import { useDeleteApiKey, useSaveApiKey, type Provider } from "../hooks/useAiSettings";

type ApiKeyInfo = components["schemas"]["ApiKeyInfo"];

const t = it.settings.apiKey;

/** Stessi vincoli di `ApiKeyInput` del contratto. */
export function validateApiKey(value: string): string | undefined {
  if (!value) return t.errors.required;
  if (/\s/.test(value)) return t.errors.spaces;
  if (value.length < 16) return t.errors.tooShort;
  if (value.length > 512) return t.errors.tooLong;
  return undefined;
}

/**
 * Chiave API del provider. La chiave esiste solo nello stato di questo componente mentre
 * si digita: dopo "Verifica e salva" il campo si svuota e resta visibile solo `•••• 1234`.
 */
export function ApiKeyField({ provider, info }: { provider: Provider; info?: ApiKeyInfo }) {
  const [replacing, setReplacing] = useState(false);
  const savedRef = useRef<HTMLDivElement>(null);
  const providerName = it.aiProviders[provider];

  if (info && !replacing) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t.label}</span>
        <div
          ref={savedRef}
          tabIndex={-1}
          className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 outline-none focus-visible:ring-2"
        >
          <CheckCircle2
            className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400"
            aria-hidden
          />
          <span className="sr-only">{t.savedLabel(providerName)}:</span>
          <span className="font-mono text-sm" data-testid="api-key-masked">
            {t.masked(info.last4)}
          </span>
          <span className="text-muted-foreground text-sm">
            · {info.verifiedAt ? t.verifiedOn(formatDate(info.verifiedAt)) : t.notVerified}
          </span>
          <span className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setReplacing(true)}
            >
              <KeyRound aria-hidden />
              {t.replace}
            </Button>
            <DeleteKeyButton provider={provider} />
          </span>
        </div>
      </div>
    );
  }

  return (
    <ApiKeyForm
      provider={provider}
      onCancel={info ? () => setReplacing(false) : undefined}
      onSaved={() => {
        setReplacing(false);
        // Il focus va sulla chiave mascherata appena compare.
        requestAnimationFrame(() => savedRef.current?.focus());
      }}
    />
  );
}

function ApiKeyForm({
  provider,
  onCancel,
  onSaved,
}: {
  provider: Provider;
  onCancel?: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const { save, pending } = useSaveApiKey();
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const apiKey = value.trim();
    const invalid = validateApiKey(apiKey);
    if (invalid) {
      setError(invalid);
      inputRef.current?.focus();
      return;
    }
    setError(undefined);
    try {
      await save(provider, apiKey);
      setValue("");
      setVisible(false);
      toast.success(t.saved);
      onSaved();
    } catch (err) {
      setError(isApiError(err) ? err.message : apiErrorMessage("UNKNOWN"));
      inputRef.current?.focus();
    }
  };

  return (
    // Non è un <form>: sta dentro il form delle impostazioni, ma ha il suo invio.
    <div className="flex flex-col gap-2">
      <Field id="ai-api-key" label={t.label} hint={t.hint} error={error}>
        {(control) => (
          <div className="flex gap-2">
            <Input
              {...control}
              ref={inputRef}
              // Non è un campo password: i gestori di password del browser proporrebbero di
              // salvare la chiave. Il testo è mascherato via CSS finché non si preme "Mostra".
              type="text"
              data-masked={visible ? undefined : "true"}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                if (!pending) void submit();
              }}
              placeholder={t.placeholder}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              className={cn("h-11 font-mono", !visible && "[-webkit-text-security:disc]")}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0"
              aria-label={visible ? t.hide : t.show}
              aria-pressed={visible}
              onClick={() => setVisible((current) => !current)}
            >
              {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </Button>
          </div>
        )}
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-11" disabled={pending} onClick={() => void submit()}>
          {pending ? t.saving : t.save}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" className="h-11" onClick={onCancel}>
            {t.cancelReplace}
          </Button>
        )}
      </div>
    </div>
  );
}

function DeleteKeyButton({ provider }: { provider: Provider }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = useDeleteApiKey();

  const onConfirm = async () => {
    setError(null);
    try {
      await remove.mutateAsync(provider);
      setOpen(false);
      toast.success(t.deleted);
      // Il pulsante che ha aperto il dialog non c'è più: il focus va sul campo della nuova chiave.
      setTimeout(() => document.getElementById("ai-api-key")?.focus(), 0);
    } catch (err) {
      setError(isApiError(err) ? err.message : apiErrorMessage("UNKNOWN"));
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <AlertDialogTrigger
        render={<Button type="button" variant="outline" className="text-destructive h-11" />}
      >
        <Trash2 aria-hidden />
        {t.delete}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
          <AlertDialogDescription>{t.deleteDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11">{t.cancel}</AlertDialogCancel>
          <Button
            variant="destructive"
            className="h-11"
            disabled={remove.isPending}
            onClick={() => void onConfirm()}
          >
            {remove.isPending ? t.deleting : t.deleteConfirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
