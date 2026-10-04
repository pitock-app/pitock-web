import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/features/auth";
import { AuthError } from "@/lib/auth";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
const auth = vi.hoisted(() => ({ signIn: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  getAuthProvider: () => auth,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText("Email"), email);
  if (password) await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Accedi" }));
}

describe("LoginForm", () => {
  it("mostra gli errori di validazione collegati ai campi", async () => {
    render(<LoginForm />);
    await fillAndSubmit("", "");

    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription("Inserisci un indirizzo email valido.");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Inserisci la password.");
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it("dopo il login va alla pagina indicata da next", async () => {
    auth.signIn.mockResolvedValue({});
    render(<LoginForm next="/receipts" />);
    await fillAndSubmit("anna@pitock.test", "segreta");

    expect(auth.signIn).toHaveBeenCalledWith("anna@pitock.test", "segreta");
    expect(router.replace).toHaveBeenCalledWith("/receipts");
  });

  it("ignora un next esterno", async () => {
    auth.signIn.mockResolvedValue({});
    render(<LoginForm next="https://evil.example" />);
    await fillAndSubmit("anna@pitock.test", "segreta");
    expect(router.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("mostra l'errore di credenziali non valide", async () => {
    auth.signIn.mockRejectedValue(new AuthError("invalid_credentials"));
    render(<LoginForm />);
    await fillAndSubmit("anna@pitock.test", "sbagliata");

    expect(await screen.findByRole("alert")).toHaveTextContent("Email o password non corretti.");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("in modalità mock spiega che va bene qualunque credenziale", () => {
    render(<LoginForm mockMode />);
    expect(screen.getByText(/qualunque email e password/)).toBeInTheDocument();
  });
});
