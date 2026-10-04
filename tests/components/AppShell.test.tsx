import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout";

const pathname = vi.hoisted(() => ({ current: "/receipts/123" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

describe("AppShell", () => {
  it("mostra contenuto, link per saltare al contenuto e due navigazioni (sidebar e bottom nav)", () => {
    render(
      <AppShell>
        <p>Contenuto</p>
      </AppShell>,
    );

    expect(screen.getByRole("main")).toHaveTextContent("Contenuto");
    expect(screen.getByRole("link", { name: "Vai al contenuto" })).toHaveAttribute("href", "#main");
    expect(screen.getAllByRole("navigation", { name: "Navigazione principale" })).toHaveLength(2);
  });

  it("segna come corrente la voce della sezione aperta", () => {
    render(
      <AppShell>
        <p>Contenuto</p>
      </AppShell>,
    );

    for (const nav of screen.getAllByRole("navigation", { name: "Navigazione principale" })) {
      const current = within(nav).getByRole("link", { current: "page" });
      expect(current).toHaveAttribute("href", "/receipts");
    }
  });

  it("offre l'azione Aggiungi in entrambe le navigazioni", () => {
    render(
      <AppShell>
        <p>Contenuto</p>
      </AppShell>,
    );

    const addLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/add");
    expect(addLinks).toHaveLength(2);
  });
});
