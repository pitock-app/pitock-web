"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
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
import { apiErrorMessage, isApiError } from "@/lib/api/errors";
import { it } from "@/lib/i18n/it";
import { routes } from "@/lib/routes";
import { useDeleteReceipt } from "./hooks/useReceipt";

const t = it.receipt.delete;

/** "Elimina" con conferma; dopo l'eliminazione torna alla lista. */
export function DeleteReceiptDialog({ receiptId }: { receiptId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = useDeleteReceipt();

  const onConfirm = async () => {
    setError(null);
    try {
      await remove.mutateAsync(receiptId);
      setOpen(false);
      toast.success(t.deleted);
      router.replace(routes.receipts);
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
      <AlertDialogTrigger render={<Button variant="destructive" className="h-11" />}>
        <Trash2 aria-hidden />
        {it.receipt.actions.delete}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.title}</AlertDialogTitle>
          <AlertDialogDescription>{t.description}</AlertDialogDescription>
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
            {remove.isPending ? t.deleting : t.confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
