"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Field } from "@/components/form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { components } from "@/lib/api/schema";
import { it } from "@/lib/i18n/it";
import { cn } from "@/lib/utils";

type ModelInfo = components["schemas"]["ModelInfo"];

const t = it.settings.model;

/** Voce "ID personalizzato…" in fondo all'elenco. */
export const CUSTOM_MODEL = "__custom__";

function CapabilityBadges({ model }: { model: ModelInfo }) {
  return (
    <span className="flex shrink-0 gap-1">
      {model.supportsImages && <Badge variant="secondary">{t.images}</Badge>}
      {model.supportsPdf && <Badge variant="secondary">{t.pdf}</Badge>}
    </span>
  );
}

type Option = { id: string; model?: ModelInfo };

/** Combobox ARIA 1.2 con elenco filtrato: frecce, Invio per scegliere, Esc per chiudere. */
export function ModelCombobox({
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
    return [...filtered.map((model) => ({ id: model.id, model })), { id: CUSTOM_MODEL }];
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
