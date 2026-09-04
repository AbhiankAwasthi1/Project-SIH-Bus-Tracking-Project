/**
 * The single HTTP entry point for the frontend.
 *
 * Everything that talks to the backend goes through `request()` so that request
 * construction, the auth header, error parsing and 401 handling exist in exactly
 * one place.
 *
 * Paths stay relative to `/api` on purpose: the dev server proxies `/api` to
 * 127.0.0.1:8000 (apps/web/vite.config.ts) and nginx proxies `/api/` to the api
 * container (infra/nginx.conf). Introducing an absolute base URL would break
 * both, so it is deliberately not configurable here.
 */

const API_PREFIX = "/api";

/** Applies to JSON requests only. Uploads opt out with `timeoutMs: null`. */
const DEFAULT_TIMEOUT_MS = 15_000;

export type ApiErrorKind = "http" | "network" | "timeout" | "parse";

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never produced a response. */
  readonly status: number;
  readonly kind: ApiErrorKind;

  constructor(message: string, init: { status: number; kind: ApiErrorKind }) {
    super(message);
    this.name = "ApiError";
    this.status = init.status;
    this.kind = init.kind;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isOffline(): boolean {
    return this.kind === "network" || this.kind === "timeout";
  }
}

/**
 * Auth is injected rather than imported so this module stays independent of any
 * particular auth implementation. `src/auth` registers the provider at startup;
 * a future Supabase integration can register a different one without touching
 * any service or component.
 */
type TokenProvider = () => string | null;

let tokenProvider: TokenProvider = () => null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** Serialised as a JSON body with the matching Content-Type. */
  json?: unknown;
  /** Raw body, used for multipart uploads. Mutually exclusive with `json`. */
  body?: BodyInit;
  /** Attach the bearer token. Defaults to true. */
  auth?: boolean;
  /** Route 401s to the global handler. Disable where 401 is an expected answer. */
  reportUnauthorized?: boolean;
  /** `null` disables the timeout entirely. */
  timeoutMs?: number | null;
};

function buildHeaders(options: RequestOptions): Headers {
  const headers = new Headers();
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.auth !== false) {
    const token = tokenProvider();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return headers;
}

/**
 * Preserves the previous error contract: prefer the backend's `detail` string,
 * fall back to the status text. Never include headers or the request body, so a
 * bearer token cannot reach a log or an error boundary.
 */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object" && "detail" in payload) {
      const detail = (payload as { detail?: unknown }).detail;
      if (typeof detail === "string" && detail.trim()) {
        return detail;
      }
    }
  } catch {
    /* Body was empty or not JSON; fall through to the status text. */
  }
  return response.statusText || `Request failed with status ${response.status}`;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", json, body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const controller = new AbortController();
  let timedOut = false;
  const timer =
    timeoutMs === null
      ? null
      : setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      method,
      headers: buildHeaders(options),
      body: json !== undefined ? JSON.stringify(json) : body,
      signal: controller.signal,
    });
  } catch {
    throw timedOut
      ? new ApiError("The server took too long to respond.", { status: 0, kind: "timeout" })
      : new ApiError("Cannot reach the Drishti API.", { status: 0, kind: "network" });
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    if (response.status === 401 && options.reportUnauthorized !== false) {
      unauthorizedHandler?.();
    }
    throw new ApiError(message, { status: response.status, kind: "http" });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("The server returned a malformed response.", {
      status: response.status,
      kind: "parse",
    });
  }
}

/** Builds a query string, dropping empty values. Mirrors the previous behaviour. */
export function toQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Turns any thrown value into a message that is safe to show a user. */
export function toErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
