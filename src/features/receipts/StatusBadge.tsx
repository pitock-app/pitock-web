import { AlertCircle, CheckCircle2, Clock, Loader2, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { components } from "@/lib/api/schema";
import { it } from "@/lib/i18n/it";

type ReceiptStatus = components["schemas"]["ReceiptStatus"];

/** Stato dello scontrino: icona e testo, non solo colore. */
export function StatusBadge({ status }: { status: ReceiptStatus }) {
  const label = it.receiptStatuses[status];
  switch (status) {
    case "extracted":
      return (
        <Badge className="bg-brand text-brand-foreground">
          <CheckCircle2 aria-hidden />
          {label}
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <AlertCircle aria-hidden />
          {label}
        </Badge>
      );
    case "pending_upload":
      return (
        <Badge variant="outline">
          <UploadCloud aria-hidden />
          {label}
        </Badge>
      );
    case "uploaded":
      return (
        <Badge variant="secondary">
          <Clock aria-hidden />
          {label}
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="secondary">
          <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
          {label}
        </Badge>
      );
  }
}
