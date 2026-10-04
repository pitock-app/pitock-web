import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorState } from "@/components/layout";

describe("ErrorState", () => {
  it("mostra il messaggio e chiama onRetry con Riprova", async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Qualcosa è andato storto");
    await userEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("non mostra Riprova senza onRetry", () => {
    render(<ErrorState />);
    expect(screen.queryByRole("button", { name: "Riprova" })).not.toBeInTheDocument();
  });
});
