import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountInfo } from "@/features/settings";
import { createMockAuthProvider } from "@/lib/auth/mock-auth";
import type { AuthProvider } from "@/lib/auth";
import { server, setupMswServer } from "../helpers/msw-server";
import { renderWithQuery } from "../helpers/render";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const provider = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getAuthProvider: () => provider.current,
}));

setupMswServer();

let auth: AuthProvider;

beforeEach(async () => {
  vi.clearAllMocks();
  auth = createMockAuthProvider();
  provider.current = auth;
  await auth.signIn("anna@pitock.test", "x");
});

describe("AccountInfo", () => {
  it("mostra l'email dell'utente", async () => {
    renderWithQuery(<AccountInfo />);
    expect(await screen.findByText("anna@pitock.test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Esci" })).toBeInTheDocument();
  });

  it("elimina l'account solo dopo aver scritto ELIMINA, poi logout e home", async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.events.on("request:start", async ({ request }) => {
      if (request.method === "DELETE") body = await request.clone().json();
    });
    renderWithQuery(<AccountInfo />);
    await user.click(await screen.findByRole("button", { name: "Elimina account" }));
    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByLabelText("Scrivi ELIMINA per confermare");
    await user.type(confirm, "elimina");
    await user.click(within(dialog).getByRole("button", { name: "Elimina definitivamente" }));
    expect(
      await within(dialog).findByText("Scrivi ELIMINA in maiuscolo per confermare."),
    ).toBeInTheDocument();
    expect(body).toBeUndefined();

    await user.clear(confirm);
    await user.type(confirm, "ELIMINA");
    await user.click(within(dialog).getByRole("button", { name: "Elimina definitivamente" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(body).toEqual({ confirm: "ELIMINA" });
    expect(await auth.getSession()).toBeNull();
    server.events.removeAllListeners();
  });
});
