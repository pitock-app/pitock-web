"use client";

import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
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
import { it } from "@/lib/i18n/it";
import { useDeleteAccount } from "../hooks/useDeleteAccount";

const t = it.settings.account;

/** "Elimina account": si conferma scrivendo ELIMINA, poi `DELETE /v1/account`, logout e home. */
export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const remove = useDeleteAccount();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (confirm.trim() !== t.confirmWord) {
      setMismatch(true);
      document.getElementById("delete-account-confirm")?.focus();
      return;
    }
    setError(null);
    try {
      await remove.mutateAsync();
      toast.success(t.deleted);
    } catch (err) {
      setError(isApiError(err) ? err.message : apiErrorMessage("UNKNOWN"));
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (remove.isPending) return;
        setOpen(next);
        if (next) {
          setConfirm("");
          setError(null);
          setMismatch(false);
        }
      }}
    >
      <AlertDialogTrigger render={<Button variant="destructive" className="h-11" />}>
        <Trash2 aria-hidden />
        {t.delete}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <Field
            id="delete-account-confirm"
            label={t.confirmLabel}
            error={mismatch ? t.confirmMismatch : undefined}
          >
            {(control) => (
              <Input
                {...control}
                value={confirm}
                onChange={(event) => {
                  setConfirm(event.target.value);
                  setMismatch(false);
                }}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="h-11"
              />
            )}
          </Field>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11" disabled={remove.isPending}>
              {t.cancel}
            </AlertDialogCancel>
            <Button
              type="submit"
              variant="destructive"
              className="h-11"
              disabled={remove.isPending}
            >
              {remove.isPending ? t.deleting : t.confirm}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
