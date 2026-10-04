import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UploadQueueItem, type QueueItem } from "@/features/capture";

const base: QueueItem = {
  id: "q1",
  file: new File(["x"], "scontrino.pdf", { type: "application/pdf" }),
  name: "scontrino.pdf",
  source: "file",
  status: "processing",
  progress: null,
  receiptId: "11111111-1111-4111-8111-111111111111",
};

function renderItem(item: Partial<QueueItem>) {
  const handlers = { onRetry: vi.fn(), onRemove: vi.fn(), onDismiss: vi.fn() };
  render(
    <ul>
      <UploadQueueItem item={{ ...base, ...item }} {...handlers} />
    </ul>,
  );
  return handlers;
}

describe("UploadQueueItem", () => {
  it("mostra l'avanzamento durante l'upload", () => {
    renderItem({ status: "uploading", progress: 40 });
    expect(screen.getByText("Caricamento")).toBeVisible();
    expect(
      screen.getByRole("progressbar", { name: "Avanzamento di scontrino.pdf" }),
    ).toHaveAttribute("aria-valuenow", "40");
  });

  it("quando è pronto mostra esercente, data, totale, categoria e i link", () => {
    renderItem({
      status: "done",
      result: {
        merchantName: "Esselunga",
        purchasedAt: "2026-10-04T10:00:00Z",
        total: 23.4,
        currency: "EUR",
        category: "alimentari",
      },
    });
    expect(screen.getByText("Pronto")).toBeVisible();
    expect(screen.getByText("Esselunga")).toBeVisible();
    expect(screen.getByText("4 ott 2026")).toBeVisible();
    expect(screen.getByText(/23,40/)).toBeVisible();
    expect(screen.getByText("Alimentari")).toBeVisible();
    expect(screen.getByRole("link", { name: "Apri" })).toHaveAttribute(
      "href",
      `/receipts/${base.receiptId}`,
    );
    expect(screen.getByRole("link", { name: "Correggi" })).toHaveAttribute(
      "href",
      `/receipts/${base.receiptId}?edit=1`,
    );
  });

  it("in errore mostra il motivo in italiano con Riprova ed Elimina", async () => {
    const user = userEvent.setup();
    const handlers = renderItem({
      status: "failed",
      errorCode: "USER_KEY_INVALID",
      failedStep: "extraction",
    });
    expect(screen.getByText("La tua chiave API non è valida.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Vai alle impostazioni" })).toHaveAttribute(
      "href",
      "/settings/ai",
    );
    await user.click(screen.getByRole("button", { name: "Riprova" }));
    await user.click(screen.getByRole("button", { name: "Elimina" }));
    expect(handlers.onRetry).toHaveBeenCalledWith("q1");
    expect(handlers.onRemove).toHaveBeenCalledWith("q1");
  });

  it("NOT_A_RECEIPT e quota della piattaforma", () => {
    renderItem({ status: "failed", errorCode: "NOT_A_RECEIPT", failedStep: "extraction" });
    expect(screen.getByText("Non sembra uno scontrino.")).toBeVisible();
  });

  it("invita a inserire una chiave quando la quota è finita", () => {
    renderItem({
      status: "failed",
      errorCode: "PLATFORM_QUOTA_EXCEEDED",
      failedStep: "extraction",
    });
    expect(screen.getByRole("link", { name: "Inserisci una chiave" })).toBeVisible();
  });

  it("un duplicato porta allo scontrino esistente", () => {
    renderItem({ status: "duplicate", receiptId: undefined, duplicateOf: "abc" });
    expect(screen.getByText("Duplicato")).toBeVisible();
    expect(screen.getByRole("link", { name: "Vedi lo scontrino già caricato" })).toHaveAttribute(
      "href",
      "/receipts/abc",
    );
  });
});
