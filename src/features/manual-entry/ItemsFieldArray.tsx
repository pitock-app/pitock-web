"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRef } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Field } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { it } from "@/lib/i18n/it";
import { emptyItem, type ManualEntryValues } from "./manual-entry.schema";

const t = it.manualEntry;

/** Righe facoltative dello scontrino (`useFieldArray`). */
export function ItemsFieldArray({ idPrefix = "receipt" }: { idPrefix?: string }) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<ManualEntryValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const addButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-base font-semibold">{t.items}</legend>
      <p className="text-muted-foreground -mt-1 text-sm">{t.itemsHint}</p>

      {fields.map((field, index) => {
        const id = (name: string) => `${idPrefix}-items-${index}-${name}`;
        const itemErrors = errors.items?.[index];
        return (
          <div
            key={field.id}
            role="group"
            aria-label={t.itemLabel(index + 1)}
            className="bg-muted/40 grid gap-3 rounded-lg border p-3 sm:grid-cols-[2fr_repeat(4,1fr)_auto]"
          >
            <Field
              id={id("description")}
              label={t.description}
              error={itemErrors?.description?.message}
            >
              {(c) => <Input {...c} className="h-11" {...register(`items.${index}.description`)} />}
            </Field>
            <Field id={id("quantity")} label={t.quantity} error={itemErrors?.quantity?.message}>
              {(c) => (
                <Input
                  {...c}
                  inputMode="decimal"
                  className="h-11"
                  {...register(`items.${index}.quantity`)}
                />
              )}
            </Field>
            <Field id={id("unitPrice")} label={t.unitPrice} error={itemErrors?.unitPrice?.message}>
              {(c) => (
                <Input
                  {...c}
                  inputMode="decimal"
                  className="h-11"
                  {...register(`items.${index}.unitPrice`)}
                />
              )}
            </Field>
            <Field id={id("amount")} label={t.amount} error={itemErrors?.amount?.message}>
              {(c) => (
                <Input
                  {...c}
                  inputMode="decimal"
                  className="h-11"
                  {...register(`items.${index}.amount`)}
                />
              )}
            </Field>
            <Field id={id("vatRate")} label={t.vatRate} error={itemErrors?.vatRate?.message}>
              {(c) => (
                <Input
                  {...c}
                  inputMode="decimal"
                  className="h-11"
                  {...register(`items.${index}.vatRate`)}
                />
              )}
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 self-end"
              aria-label={t.removeItem(index + 1)}
              onClick={() => {
                remove(index);
                addButtonRef.current?.focus();
              }}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        );
      })}

      <Button
        ref={addButtonRef}
        type="button"
        variant="outline"
        className="h-11 w-fit"
        onClick={() => append({ ...emptyItem })}
      >
        <Plus aria-hidden />
        {t.addItem}
      </Button>
    </fieldset>
  );
}
