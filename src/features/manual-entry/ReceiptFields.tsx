"use client";

import { useFormContext } from "react-hook-form";
import { Field, NativeSelect } from "@/components/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { categories, paymentMethods } from "@/lib/api/enums";
import { it } from "@/lib/i18n/it";
import type { ManualEntryValues } from "./manual-entry.schema";

const t = it.manualEntry;

/**
 * Campi principali di uno scontrino. Usano il contesto di react-hook-form,
 * così possono servire sia all'inserimento manuale sia alla correzione.
 */
export function ReceiptFields({ idPrefix = "receipt" }: { idPrefix?: string }) {
  const {
    register,
    formState: { errors },
  } = useFormContext<ManualEntryValues>();
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        id={id("merchantName")}
        label={t.merchantName}
        error={errors.merchantName?.message}
        className="sm:col-span-2"
      >
        {(control) => (
          <Input
            {...control}
            autoComplete="organization"
            className="h-11"
            {...register("merchantName")}
          />
        )}
      </Field>

      <Field id={id("purchasedAt")} label={t.purchasedAt} error={errors.purchasedAt?.message}>
        {(control) => (
          <Input {...control} type="datetime-local" className="h-11" {...register("purchasedAt")} />
        )}
      </Field>

      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Field id={id("total")} label={t.total} error={errors.total?.message} hint={t.amountHint}>
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              autoComplete="off"
              placeholder={t.amountPlaceholder}
              className="h-11"
              {...register("total")}
            />
          )}
        </Field>
        <Field id={id("currency")} label={t.currency} error={errors.currency?.message}>
          {(control) => (
            <Input
              {...control}
              maxLength={3}
              autoCapitalize="characters"
              autoComplete="off"
              className="h-11 uppercase"
              {...register("currency")}
            />
          )}
        </Field>
      </div>

      <Field id={id("category")} label={t.category} error={errors.category?.message}>
        {(control) => (
          <NativeSelect {...control} {...register("category")}>
            <option value="">{t.choose}</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {it.categories[value]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field id={id("paymentMethod")} label={t.paymentMethod} error={errors.paymentMethod?.message}>
        {(control) => (
          <NativeSelect {...control} {...register("paymentMethod")}>
            <option value="">{t.choose}</option>
            {paymentMethods.map((value) => (
              <option key={value} value={value}>
                {it.paymentMethods[value]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field
        id={id("merchantVat")}
        label={t.merchantVat}
        labelSuffix={t.optional}
        error={errors.merchantVat?.message}
      >
        {(control) => (
          <Input {...control} autoComplete="off" className="h-11" {...register("merchantVat")} />
        )}
      </Field>

      <Field
        id={id("taxTotal")}
        label={t.taxTotal}
        labelSuffix={t.optional}
        error={errors.taxTotal?.message}
      >
        {(control) => (
          <Input
            {...control}
            inputMode="decimal"
            autoComplete="off"
            placeholder={t.amountPlaceholder}
            className="h-11"
            {...register("taxTotal")}
          />
        )}
      </Field>

      <Field
        id={id("notes")}
        label={t.notes}
        labelSuffix={t.optional}
        error={errors.notes?.message}
        className="sm:col-span-2"
      >
        {(control) => <Textarea {...control} rows={2} {...register("notes")} />}
      </Field>
    </div>
  );
}
