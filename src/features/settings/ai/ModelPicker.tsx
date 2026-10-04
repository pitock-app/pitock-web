"use client";

import { AlertTriangle, Check, ChevronsUpDown, RotateCw } from "lucide-react";
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Field } from "@/components/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";
import { useAiModels, type Provider } from "../hooks/useAiSettings";

type ModelInfo = components["schemas"]["ModelInfo"];

const t = it.settings.model;
const MODEL_ID = /^[\w.:/@+-]{1,200}$/;
const CUSTOM = "__custom__";

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
            if (id === CUSTOM) {
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

function CapabilityBadges({ model }: { model: ModelInfo }) {
  return (
    <span className="flex shrink-0 gap-1">
      {model.supportsImages && <Badge variant="secondary">{t.images}</Badge>}
      {model.supportsPdf && <Badge variant="secondary">{t.pdf}</Badge>}
    </span>
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

type Option = { id: string; model?: ModelInfo };

/** Combobox ARIA 1.2 con elenco filtrato: frecce, Invio per scegliere, Esc per chiudere. */
function ModelCombobox({
  models,
  selected,
  error,
  onSelect,
}: {
  models: ModelInfo[];
  selected?: ModelInfo;
  error?: string;
  onSelect: (id: string) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const options = useMemo<Option[]>(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? models.filter(
          (model) =>
            model.id.toLowerCase().includes(needle) || model.label.toLowerCase().includes(needle),
        )
      : models;
    return [...filtered.map((model) => ({ id: model.id, model })), { id: CUSTOM }];
  }, [models, query]);

  const optionId = (index: number) => `${listId}-option-${index}`;

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-option-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, listId]);

  const choose = (option: Option) => {
    onSelect(option.id);
    setOpen(false);
    setQuery("");
  };

  const openList = () => {
    setOpen(true);
    setQuery("");
    const index = selected ? models.findIndex((model) => model.id === selected.id) : 0;
    setActive(Math.max(0, index));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) openList();
        else setActive((index) => Math.min(options.length - 1, index + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) openList();
        else setActive((index) => Math.max(0, index - 1));
        break;
      case "Home":
        if (open) {
          event.preventDefault();
          setActive(0);
        }
        break;
      case "End":
        if (open) {
          event.preventDefault();
          setActive(options.length - 1);
        }
        break;
      case "Enter":
        if (open && options[active]) {
          event.preventDefault();
          choose(options[active]);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
          setQuery("");
        }
        break;
    }
  };

  const selectedText = selected ? `${selected.label} (${selected.id})` : "";
  // Aperto, il campo serve a cercare: la scelta attuale resta visibile come segnaposto.
  const display = open ? query : selectedText;

  return (
    <Field
      id="ai-model"
      label={t.label}
      hint={`${t.hint} ${t.count(models.length)}.`}
      error={error}
    >
      {(control) => (
        <div className="relative">
          <Input
            {...control}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && options[active] ? optionId(active) : undefined}
            value={display}
            placeholder={open && selectedText ? selectedText : t.placeholder}
            autoComplete="off"
            spellCheck={false}
            className="h-11 pr-10"
            onClick={() => !open && openList()}
            onBlur={() => {
              setOpen(false);
              setQuery("");
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
          />
          <ChevronsUpDown
            className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <span role="status" aria-live="polite" className="sr-only">
            {open ? t.results(options.length - 1) : ""}
          </span>
          <ul
            id={listId}
            role="listbox"
            aria-label={t.listLabel}
            hidden={!open}
            // Anche un clic sulla barra di scorrimento non deve togliere il focus all'input.
            onMouseDown={(event) => event.preventDefault()}
            className="bg-popover text-popover-foreground absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border p-1 shadow-lg"
          >
            {options.length === 1 && (
              <li role="presentation" className="text-muted-foreground px-3 py-2 text-sm">
                {t.noResults}
              </li>
            )}
            {options.map((option, index) => {
              const isSelected = option.model !== undefined && option.id === selected?.id;
              return (
                <li
                  key={option.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  // mousedown prima del blur dell'input: la scelta non si perde.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                  onMouseMove={() => setActive(index)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm",
                    index === active && "bg-accent text-accent-foreground",
                    !option.model && "border-t font-medium",
                  )}
                >
                  <Check
                    className={cn("size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                    aria-hidden
                  />
                  {option.model ? (
                    <>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{option.model.label}</span>
                        <span className="text-muted-foreground truncate font-mono text-xs">
                          {option.model.id}
                        </span>
                      </span>
                      <CapabilityBadges model={option.model} />
                    </>
                  ) : (
                    t.custom
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Field>
  );
}
