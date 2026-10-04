import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiSettingsView } from "@/features/settings";
import { createMockAuthProvider } from "@/lib/auth/mock-auth";
import { server, setupMswServer } from "../helpers/msw-server";
import { renderWithQuery } from "../helpers/render";

const provider = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getAuthProvider: () => provider.current,
}));

setupMswServer();

beforeEach(async () => {
  const auth = createMockAuthProvider();
  provider.current = auth;
  await auth.signIn("anna@pitock.test", "x");
});

/**
 * Testo, valori dei campi e attributi che contengono "sk-". Le classi sono escluse:
 * le icone hanno nomi come "lucide-flask-conical".
 */
function secretsIn(root: HTMLElement): string[] {
  const found: string[] = [];
  if (root.textContent?.includes("sk-")) found.push(root.textContent);
  for (const element of root.querySelectorAll("*")) {
    if (element instanceof HTMLInputElement && element.value.includes("sk-")) {
      found.push(element.value);
    }
    for (const attribute of element.attributes) {
      if (attribute.name !== "class" && attribute.value.includes("sk-"))
        found.push(attribute.value);
    }
  }
  return found;
}

async function chooseByok(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("radio", { name: /La mia chiave/ }));
}

describe("AiSettingsView", () => {
  it("con Pitock AI mostra la quota mensile", async () => {
    renderWithQuery(<AiSettingsView />);
    expect(await screen.findByRole("radio", { name: /Pitock AI/ })).toBeChecked();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      expect.stringMatching(/^\d+ \/ 100 scontrini questo mese$/),
    );
  });

  it("una chiave non valida mostra l'errore e non viene salvata", async () => {
    const user = userEvent.setup();
    renderWithQuery(<AiSettingsView />);
    await chooseByok(user);
    await user.selectOptions(screen.getByLabelText("Provider"), "openai");
    await user.type(screen.getByLabelText("Chiave API"), "sk-invalid-000000000000");
    await user.click(screen.getByRole("button", { name: "Verifica e salva" }));
    expect(await screen.findByText("La tua chiave API non è valida.")).toBeInTheDocument();
    expect(screen.queryByTestId("api-key-masked")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Chiave API")).toHaveValue("sk-invalid-000000000000");
  });

  it("dopo il salvataggio il DOM contiene solo le ultime 4 cifre", async () => {
    const user = userEvent.setup();
    const { container } = renderWithQuery(<AiSettingsView />);
    await chooseByok(user);
    await user.selectOptions(screen.getByLabelText("Provider"), "openai");
    const input = screen.getByLabelText("Chiave API");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("data-masked", "true");
    await user.type(input, "sk-segreta-abcdefgh9876");
    await user.click(screen.getByRole("button", { name: "Mostra la chiave" }));
    expect(input).not.toHaveAttribute("data-masked");
    await user.click(screen.getByRole("button", { name: "Verifica e salva" }));
    expect(await screen.findByTestId("api-key-masked")).toHaveTextContent("•••• 9876");
    expect(secretsIn(container)).toEqual([]);
    expect(screen.queryByLabelText("Chiave API")).not.toBeInTheDocument();
  });

  it("sceglie il modello con il combobox e salva con PUT /v1/settings/ai", async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.events.on("request:start", async ({ request }) => {
      if (request.method === "PUT" && request.url.endsWith("/settings/ai")) {
        body = await request.clone().json();
      }
    });
    renderWithQuery(<AiSettingsView />);
    await chooseByok(user);
    await user.selectOptions(screen.getByLabelText("Provider"), "openai");
    await user.type(screen.getByLabelText("Chiave API"), "sk-buona-abcdefgh1234");
    await user.click(screen.getByRole("button", { name: "Verifica e salva" }));
    await screen.findByTestId("api-key-masked");

    const combobox = await screen.findByRole("combobox", { name: "Modello preferito" });
    await user.click(combobox);
    await user.type(combobox, "o3");
    const listbox = screen.getByRole("listbox");
    const option = within(listbox).getByRole("option", { name: /o3-mini/ });
    await user.click(option);
    // Il modello non legge immagini né PDF: compaiono gli avvisi.
    expect(screen.getByText(/non legge le immagini/)).toBeInTheDocument();
    expect(screen.getByText(/non legge i PDF/)).toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: /usa Pitock AI/ }));
    await user.click(screen.getByRole("button", { name: "Salva impostazioni" }));
    await waitFor(() =>
      expect(body).toEqual({
        mode: "byok",
        provider: "openai",
        model: "o3-mini",
        fallbackToPlatform: true,
      }),
    );
    expect(
      await screen.findByText("Modifiche non salvate", { exact: false }).catch(() => null),
    ).toBeNull();
    server.events.removeAllListeners();
  });

  it("il combobox si usa da tastiera e offre l'ID personalizzato", async () => {
    const user = userEvent.setup();
    renderWithQuery(<AiSettingsView />);
    await chooseByok(user);
    await user.selectOptions(screen.getByLabelText("Provider"), "openrouter");
    const combobox = await screen.findByRole("combobox", { name: "Modello preferito" });
    await user.click(combobox);
    expect(combobox).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(combobox).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{ArrowDown}");
    expect(combobox).toHaveAttribute("aria-activedescendant");
    await user.keyboard("{End}{Enter}");
    const custom = screen.getByLabelText("ID del modello");
    await user.type(custom, "vendor/modello-nuovo");
    expect(custom).toHaveValue("vendor/modello-nuovo");
  });

  it("senza chiave non salva la modalità byok", async () => {
    const user = userEvent.setup();
    renderWithQuery(<AiSettingsView />);
    await chooseByok(user);
    expect(
      screen.getByText("Salva la chiave per vedere i modelli disponibili."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salva impostazioni" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Salva prima una chiave API per Anthropic.",
    );
  });

  it("prova la configurazione e mostra l'esito", async () => {
    const user = userEvent.setup();
    renderWithQuery(<AiSettingsView />);
    await chooseByok(user);
    await user.type(screen.getByLabelText("Chiave API"), "sk-ant-abcdefgh12345678");
    await user.click(screen.getByRole("button", { name: "Verifica e salva" }));
    await screen.findByTestId("api-key-masked");
    const combobox = await screen.findByRole("combobox", { name: "Modello preferito" });
    await user.click(combobox);
    await user.click(screen.getByRole("option", { name: /Claude Sonnet 4.5/ }));
    await user.click(screen.getByRole("button", { name: "Prova configurazione" }));
    expect(await screen.findByText(/Funziona: Anthropic · claude-sonnet-4-5/)).toBeInTheDocument();
  });

  it("elimina la chiave dopo la conferma", async () => {
    const user = userEvent.setup();
    renderWithQuery(<AiSettingsView />);
    await chooseByok(user);
    await user.type(screen.getByLabelText("Chiave API"), "sk-ant-abcdefgh12345678");
    await user.click(screen.getByRole("button", { name: "Verifica e salva" }));
    await screen.findByTestId("api-key-masked");
    await user.click(screen.getByRole("button", { name: "Elimina" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Elimina chiave" }));
    expect(await screen.findByLabelText("Chiave API")).toBeInTheDocument();
  });
});
