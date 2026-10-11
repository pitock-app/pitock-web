"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { it } from "@/lib/i18n/it";
import { useAiModels, type Provider } from "../hooks/useAiSettings";
import { CUSTOM_MODEL, ModelCombobox } from "./ModelCombobox";

type ModelInfo = components["schemas"]["ModelInfo"];

const t = it.settings.model;
const MODEL_ID = /^[\w.:/@+-]{1,200}$/;

/** Stessi vincoli dell'ID del modello nel contratto (`AiSettingsInput.model`). */
export function isValidModelId(value: string): boolean {
  return MODEL_ID.test(value);
}

type ModelPickerProps = {
  provider: Provider;
  value: string;
  onChange: (model: string) => void;
  /** Senza chiave salvata il backend non elenca i modelli (tranne OpenRouter). */
  hasKey: boolean;
  error?: string;
};

/** Modello preferito: combobox con ricerca sui modelli del provider, oppure un ID personalizzato. */
export function ModelPicker({ provider, value, onChange, hasKey, error }: ModelPickerProps) {
  const enabled = hasKey || provider === "openrouter";
  const models = useAiModels(provider, enabled);
  const [customMode, setCustomMode] = useState(false);
  const list = models.data?.models;
  const selected = list?.find((model) => model.id === value);
  const isCustom = customMode || (value !== "" && list !== undefined && !selected);

  if (!enabled) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t.label}</span>
        <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-sm">
          {t.needsKey}
        </p>
      </div>
    );
  }

  if (models.isPending) {
    return (
      <div className="flex flex-col gap-1.5" role="status" aria-label={t.loading}>
        <span className="text-sm font-medium">{t.label}</span>
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  if (models.isError) {
    // Senza elenco si può comunque indicare l'ID a mano.
    const message =
      isApiError(models.error) && models.error.code !== "UNKNOWN"
        ? `${t.loadError} ${models.error.message}`
        : t.loadError;
    return (
      <div className="flex flex-col gap-2">
        <CustomModelInput value={value} onChange={onChange} error={error} />
        <div role="alert" className="text-destructive flex flex-wrap items-center gap-2 text-sm">
          {message}
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => void models.refetch()}
          >
            <RotateCw aria-hidden />
            {it.states.retry}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {isCustom ? (
        <>
          <CustomModelInput value={value} onChange={onChange} error={error} />
          <Button
            type="button"
            variant="link"
            className="h-11 self-start px-0"
            onClick={() => {
              setCustomMode(false);
              onChange("");
            }}
          >
            {t.backToList}
          </Button>
        </>
      ) : (
        <ModelCombobox
          models={models.data.models}
          selected={selected}
          error={error}
          onSelect={(id) => {
            if (id === CUSTOM_MODEL) {
              setCustomMode(true);
              onChange("");
            } else {
              onChange(id);
            }
          }}
        />
      )}
      <ModelWarnings model={selected} />
    </div>
  );
}

function CustomModelInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (model: string) => void;
  error?: string;
}) {
  const invalid = value !== "" && !isValidModelId(value) ? t.customInvalid : undefined;
  return (
    <Field id="ai-model" label={t.customLabel} hint={t.customHint} error={invalid ?? error}>
      {(control) => (
        <Input
          {...control}
          value={value}
          onChange={(event) => onChange(event.target.value.trim())}
          autoComplete="off"
          spellCheck={false}
          className="h-11 font-mono"
        />
      )}
    </Field>
  );
}

function ModelWarnings({ model }: { model?: ModelInfo }) {
  if (!model) return null;
  const warnings: string[] = [];
  if (model.supportsImages === false) warnings.push(t.noImages);
  if (model.supportsPdf === false) warnings.push(t.noPdf);
  if (warnings.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {warnings.map((warning) => (
        <li
          key={warning}
          className="flex items-start gap-2 rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-sm"
        >
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
            aria-hidden
          />
          {warning}
        </li>
      ))}
    </ul>
  );
}
