import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatLauncher } from "@/features/chat";
import { pieSlices } from "@/features/chat/ChatChart";
import { useChatStore } from "@/features/chat/store";
import type { components } from "@/lib/api/schema";
import { createMockAuthProvider } from "@/lib/auth/mock-auth";
import { server, setupMswServer } from "../helpers/msw-server";
import { renderWithQuery } from "../helpers/render";

type Schemas = components["schemas"];

const provider = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getAuthProvider: () => provider.current,
}));

setupMswServer();

// jsdom non implementa lo scroll.
Element.prototype.scrollIntoView = vi.fn();

beforeEach(async () => {
  useChatStore.getState().clear();
  const auth = createMockAuthProvider();
  provider.current = auth;
  await auth.signIn("anna@pitock.test", "x");
});

const open = async () => {
  const user = userEvent.setup();
  renderWithQuery(<ChatLauncher variant="header" />);
  await user.click(screen.getByRole("button", { name: "Chiedi a Pitock" }));
  return user;
};

describe("ChatLauncher", () => {
  it("manda la conversazione e mostra risposta e grafico", async () => {
    let sent: unknown;
    server.use(
      http.post("*/v1/chat", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json<Schemas["ChatResponse"]>({
          answer: "Hai speso 10,70 € di carne.",
          grounded: true,
          charts: [
            {
              type: "bar",
              title: "Spesa per prodotto",
              points: [
                { label: "Petto di pollo", value: 6.5 },
                { label: "Macinato bovino", value: 4.2 },
              ],
            },
          ],
        });
      }),
    );
    const user = await open();

    await user.type(screen.getByLabelText("La tua domanda"), "Quanto ho speso di carne?{Enter}");

    expect(await screen.findByText("Hai speso 10,70 € di carne.")).toBeInTheDocument();
    expect(sent).toEqual({ messages: [{ role: "user", content: "Quanto ho speso di carne?" }] });
    const chart = screen
      .getByText("Spesa per prodotto", { selector: "figcaption" })
      .closest("figure");
    if (!chart) throw new Error("grafico assente");
    expect(within(chart).getByRole("rowheader", { name: "Petto di pollo" })).toBeInTheDocument();
  });

  it("segnala la risposta non verificata", async () => {
    server.use(
      http.post("*/v1/chat", () =>
        HttpResponse.json<Schemas["ChatResponse"]>({
          answer: "Non riesco a darti una risposta verificata.",
          grounded: false,
          charts: [],
        }),
      ),
    );
    const user = await open();

    await user.click(screen.getByRole("button", { name: "Quanto ho speso di carne questo mese?" }));

    expect(await screen.findByText(/non è stato possibile verificarli/)).toBeInTheDocument();
  });

  it("mostra l'errore e riprova con la stessa domanda", async () => {
    let calls = 0;
    server.use(
      http.post("*/v1/chat", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { error: { code: "RATE_LIMITED", message: "x", requestId: "r" } },
              { status: 429 },
            )
          : HttpResponse.json<Schemas["ChatResponse"]>({
              answer: "Fatto.",
              grounded: true,
              charts: [],
            });
      }),
    );
    const user = await open();

    await user.type(screen.getByLabelText("La tua domanda"), "Quanto?{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Troppe richieste");
    await user.click(screen.getByRole("button", { name: "Riprova" }));

    expect(await screen.findByText("Fatto.")).toBeInTheDocument();
    expect(calls).toBe(2);
  });
});

describe("pieSlices", () => {
  it("tiene le prime 5 fette e raggruppa il resto in Altri", () => {
    const points = [1, 2, 3, 4, 5, 6, 7].map((v) => ({ label: `c${v}`, value: v }));
    const slices = pieSlices(points);
    expect(slices.map((s) => s.label)).toEqual(["c7", "c6", "c5", "c4", "c3", "Altri"]);
    expect(slices.at(-1)?.value).toBe(3);
  });
});
