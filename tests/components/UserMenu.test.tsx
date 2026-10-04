import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserMenu } from "@/features/auth";
import { createMockAuthProvider } from "@/lib/auth/mock-auth";
import { server, setupMswServer } from "../helpers/msw-server";
import { renderWithQuery } from "../helpers/render";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
const provider = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getAuthProvider: () => provider.current,
}));

setupMswServer();

beforeEach(async () => {
  vi.clearAllMocks();
  const auth = createMockAuthProvider();
  provider.current = auth;
  await auth.signIn("anna@pitock.test", "x");
});

describe("UserMenu", () => {
  it("mostra l'email restituita da /v1/me", async () => {
    renderWithQuery(<UserMenu />);
    expect(screen.getByRole("status")).toHaveTextContent("Caricamento…");
    expect(await screen.findByTestId("user-email")).toHaveTextContent("anna@pitock.test");
  });

  it("se /v1/me fallisce usa l'email della sessione", async () => {
    server.use(
      http.get("*/v1/me", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL", message: "boom", requestId: "r" } },
          { status: 500 },
        ),
      ),
    );
    renderWithQuery(<UserMenu />);
    expect(await screen.findByTestId("user-email")).toHaveTextContent("anna@pitock.test");
  });

  it("se /v1/me non ha l'email usa quella della sessione", async () => {
    server.use(
      http.get("*/v1/me", () =>
        HttpResponse.json({
          userId: "00000000-0000-4000-8000-000000000001",
          email: null,
          ai: { mode: "platform", provider: null, model: null },
          platformQuota: { used: 0, limit: 100 },
        }),
      ),
    );
    renderWithQuery(<UserMenu />);
    expect(await screen.findByTestId("user-email")).toHaveTextContent("anna@pitock.test");
  });

  it("cliccando sull'email apre il menu con le impostazioni", async () => {
    renderWithQuery(<UserMenu />);
    await screen.findByTestId("user-email");

    await userEvent.setup().click(screen.getByRole("button", { name: /^Menu account/ }));

    expect(await screen.findByRole("menuitem", { name: "Provider AI" })).toHaveAttribute(
      "href",
      "/settings/ai",
    );
    expect(screen.getByRole("menuitem", { name: "Consumo token" })).toHaveAttribute(
      "href",
      "/settings/usage",
    );
    expect(screen.getByRole("menuitem", { name: "Account" })).toHaveAttribute(
      "href",
      "/settings/account",
    );
  });

  it("il logout chiude la sessione, svuota la cache e torna al login", async () => {
    const { queryClient } = renderWithQuery(<UserMenu />);
    await screen.findByTestId("user-email");

    await userEvent.setup().click(screen.getByRole("button", { name: "Esci" }));

    expect(
      await (provider.current as ReturnType<typeof createMockAuthProvider>).getSession(),
    ).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(router.replace).toHaveBeenCalledWith("/login");
  });
});
