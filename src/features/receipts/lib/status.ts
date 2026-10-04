import type { components } from "@/lib/api/schema";

type ReceiptStatus = components["schemas"]["ReceiptStatus"];

/** Stati in cui il backend sta ancora lavorando sullo scontrino. */
export function isPendingStatus(status: ReceiptStatus): boolean {
  return status === "uploaded" || status === "processing";
}
