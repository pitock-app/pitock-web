import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CameraCapture } from "@/features/capture/CameraCapture";
import { useUploadQueue } from "@/features/capture/store/upload-queue.store";

const stitch = vi.hoisted(() =>
  vi.fn(async () => new Blob([new Uint8Array(30)], { type: "image/jpeg" })),
);
vi.mock("@/features/capture/lib/image-tools", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/capture/lib/image-tools")>()),
  stitchVertical: stitch,
}));

const photo = (name: string) => new File([new Uint8Array(10)], name, { type: "image/jpeg" });

beforeEach(() => {
  useUploadQueue.getState().reset();
  stitch.mockClear();
  // Desktop senza touch; URL dei blob finti.
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:pezzo-${++n}`);
  URL.revokeObjectURL = vi.fn();
});

describe("CameraCapture", () => {
  it("una foto sola va in coda così com'è", async () => {
    const user = userEvent.setup();
    render(<CameraCapture />);
    await user.upload(screen.getByLabelText("Carica una foto"), photo("a.jpg"));
    await user.click(screen.getByRole("button", { name: "Usa questa foto" }));
    expect(useUploadQueue.getState().items.map((item) => item.name)).toEqual(["a.jpg"]);
    expect(stitch).not.toHaveBeenCalled();
  });

  it("uno scontrino lungo in più pezzi diventa una sola immagine in coda", async () => {
    const user = userEvent.setup();
    render(<CameraCapture />);
    await user.upload(screen.getByLabelText("Carica una foto"), photo("alto.jpg"));
    await user.click(screen.getByRole("button", { name: "Aggiungi un pezzo" }));
    expect(screen.getByRole("region", { name: "1 pezzo dello scontrino" })).toBeInTheDocument();

    await user.upload(screen.getByLabelText("Carica una foto"), photo("basso.jpg"));
    await user.click(screen.getByRole("button", { name: "Unisci 2 pezzi e usa" }));

    expect(stitch).toHaveBeenCalledTimes(1);
    const [files] = stitch.mock.calls[0] as unknown as [File[]];
    expect(files.map((file) => file.name)).toEqual(["alto.jpg", "basso.jpg"]);
    const items = useUploadQueue.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ source: "camera" });
    expect(screen.queryByRole("region", { name: /pezz/ })).not.toBeInTheDocument();
  });

  it("i pezzi si possono annullare", async () => {
    const user = userEvent.setup();
    render(<CameraCapture />);
    await user.upload(screen.getByLabelText("Carica una foto"), photo("a.jpg"));
    await user.click(screen.getByRole("button", { name: "Aggiungi un pezzo" }));
    await user.click(screen.getByRole("button", { name: "Annulla i pezzi" }));
    expect(screen.queryByRole("region", { name: /pezz/ })).not.toBeInTheDocument();
    expect(useUploadQueue.getState().items).toHaveLength(0);
  });
});
