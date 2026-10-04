import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// next/image in jsdom: un semplice <img>.
vi.mock("next/image", async () => {
  const { createElement } = await import("react");
  return {
    default: ({ priority: _priority, ...props }: Record<string, unknown>) =>
      createElement("img", props),
  };
});
