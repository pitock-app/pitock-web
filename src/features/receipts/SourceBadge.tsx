import { Camera, FileText, PenLine, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { components } from "@/lib/api/schema";
import { it } from "@/lib/i18n/it";

type ReceiptSource = components["schemas"]["ReceiptSource"];

export const sourceIcons: Record<ReceiptSource, LucideIcon> = {
  camera: Camera,
  file: FileText,
  manual: PenLine,
};

/** Sorgente dello scontrino: Foto, File o Manuale. */
export function SourceBadge({ source }: { source: ReceiptSource }) {
  const Icon = sourceIcons[source];
  return (
    <Badge variant="outline">
      <Icon aria-hidden />
      {it.receiptSources[source]}
    </Badge>
  );
}
