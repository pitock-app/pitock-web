import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import { handlers, resetMockDb } from "@/mocks";

/** Server MSW con gli stessi handler dell'app; da importare nei test che chiamano l'API. */
export const server = setupServer(...handlers);

export function setupMswServer() {
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  afterEach(() => {
    server.resetHandlers();
    resetMockDb();
  });
  afterAll(() => server.close());
}
