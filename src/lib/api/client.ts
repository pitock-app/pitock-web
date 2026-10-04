import createClient from "openapi-fetch";
import { getAuthProvider } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { env } from "@/lib/env";
import { ApiError } from "./errors";
import { ensureMocking } from "./mocking";
import type { paths } from "./schema";

export type TokenSource = {
  getAccessToken(): Promise<string | null>;
  refreshAccessToken(): Promise<string | null>;
};

type ApiClientOptions = {
  baseUrl: string;
  auth: TokenSource;
  /** Chiamata quando anche dopo il refresh la risposta è 401. */
  onSessionExpired: () => void | Promise<void>;
  /** Attesa prima di ogni richiesta (es. avvio di MSW). */
  beforeRequest?: () => Promise<void>;
  fetch?: (request: Request) => Promise<Response>;
};

function withToken(request: Request, token: string | null): Request {
  const headers = new Headers(request.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else headers.delete("Authorization");
  return new Request(request, { headers });
}

/**
 * Client tipizzato sul contratto OpenAPI. Aggiunge il token della sessione;
 * su 401 rinnova la sessione e ripete una volta, poi chiama onSessionExpired.
 */
export function createApiClient(options: ApiClientOptions) {
  const send = (request: Request) => (options.fetch ?? globalThis.fetch)(request);

  async function authFetch(request: Request): Promise<Response> {
    await options.beforeRequest?.();
    const retryRequest = request.clone();
    const response = await send(withToken(request, await options.auth.getAccessToken()));
    if (response.status !== 401) return response;

    const refreshed = await options.auth.refreshAccessToken();
    if (refreshed) {
      const retried = await send(withToken(retryRequest, refreshed));
      if (retried.status !== 401) return retried;
    }
    await options.onSessionExpired();
    return response;
  }

  return createClient<paths>({ baseUrl: options.baseUrl, fetch: authFetch });
}

export type ApiClient = ReturnType<typeof createApiClient>;

type ApiResult<T> = { data?: T; error?: unknown; response: Response };

/**
 * Converte il risultato di openapi-fetch in dati o in un'eccezione ApiError,
 * come si aspetta TanStack Query.
 */
export async function unwrap<T>(call: Promise<ApiResult<T>>): Promise<T> {
  let result: ApiResult<T>;
  try {
    result = await call;
  } catch (cause) {
    throw ApiError.network(cause);
  }
  if (result.error !== undefined || !result.response.ok) {
    throw ApiError.fromResponse(result.error, result.response.status);
  }
  return result.data as T;
}

/** Client unico dell'app: tutte le chiamate al backend passano da qui. */
export const api = createApiClient({
  baseUrl: env.NEXT_PUBLIC_API_URL,
  auth: {
    getAccessToken: () => getAuthProvider().getAccessToken(),
    refreshAccessToken: () => getAuthProvider().refreshSession(),
  },
  beforeRequest: ensureMocking,
  async onSessionExpired() {
    await getAuthProvider()
      .signOut()
      .catch(() => undefined);
    if (typeof window !== "undefined") window.location.assign(LOGIN_PATH);
  },
});
