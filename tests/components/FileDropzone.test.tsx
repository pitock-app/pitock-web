import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { FileDropzone, useUploadQueue } from "@/features/capture";

const file = (name: string, type: string, size = 10) =>
  new File([new Uint8Array(size)], name, { type });

beforeEach(() => useUploadQueue.getState().reset());

describe("FileDropzone", () => {
  it("aggiunge i file ammessi alla coda e scarta gli altri con un messaggio", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<FileDropzone />);
    await user.upload(screen.getByTestId("file-input"), [
      file("a.jpg", "image/jpeg"),
      file("b.pdf", "application/pdf"),
      file("note.txt", "text/plain"),
    ]);

    const items = useUploadQueue.getState().items;
    expect(items.map((item) => [item.name, item.source])).toEqual([
      ["a.jpg", "file"],
      ["b.pdf", "file"],
    ]);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("note.txt: tipo di file non ammesso");
  });

  it("è raggiungibile da tastiera con un nome accessibile", () => {
    render(<FileDropzone />);
    const zone = screen.getByRole("button", {
      name: "Seleziona o trascina i file degli scontrini",
    });
    expect(zone).toHaveAttribute("tabindex", "0");
  });
});
