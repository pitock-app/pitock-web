/** Percorsi delle pagine usati in più feature. */
export const routes = {
  add: "/add",
  receipts: "/receipts",
  receipt: (id: string) => `/receipts/${encodeURIComponent(id)}`,
  editReceipt: (id: string) => `/receipts/${encodeURIComponent(id)}?edit=1`,
  settingsAi: "/settings/ai",
} as const;
