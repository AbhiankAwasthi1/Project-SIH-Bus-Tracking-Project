/**
 * The only module in the frontend that touches session storage.
 *
 * Centralising it here means the storage mechanism can be swapped (for example
 * when Supabase Auth lands) without touching services, hooks or components.
 *
 * SECURITY NOTE, stated plainly: the token lives in localStorage, which is
 * readable by any script running on this origin. Centralising access does NOT
 * make that safe against cross-site scripting; it only makes the surface small
 * and auditable. A genuinely XSS-resistant design needs an httpOnly,
 * SameSite cookie issued by the backend, which is a backend change and is out
 * of scope for this frontend task.
 *
 * Nothing here logs the token.
 */

import type { Session } from "../types";
import { setAuthTokenProvider } from "../services/apiClient";

/** Unchanged from before the refactor so existing sessions survive the upgrade. */
const SESSION_KEY = "drishti.session";

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<Session>;
  return (
    typeof candidate.token === "string" &&
    candidate.token.length > 0 &&
    typeof candidate.email === "string" &&
    typeof candidate.role === "string"
  );
}

/** Returns the stored session, or null when absent, unreadable or malformed. */
export function loadSession(): Session | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SESSION_KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
    return null;
  }
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* A failed write degrades to a session that ends with the tab. */
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* Nothing useful to do. */
  }
}

/**
 * Reads the expiry out of the backend token so the UI can react to an expired
 * session before the next request fails.
 *
 * Format produced by services/api/app/auth.py:make_token is
 *   "{id}:{email}:{role}:{exp}:{signature}"
 * with `exp` in epoch seconds. This is a read-only convenience: the signature is
 * verified by the backend and is never checked here.
 *
 * Returns null when the expiry cannot be determined, in which case the caller
 * must not treat the session as expired.
 */
export function sessionExpiresAt(token: string): number | null {
  const parts = token.split(":");
  if (parts.length !== 5) {
    return null;
  }
  const seconds = Number(parts[3]);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return seconds * 1000;
}

export function isSessionExpired(session: Session, now = Date.now()): boolean {
  const expiresAt = sessionExpiresAt(session.token);
  return expiresAt !== null && expiresAt <= now;
}

/** Milliseconds until expiry, or null when the expiry is unknown. */
export function millisUntilExpiry(session: Session, now = Date.now()): number | null {
  const expiresAt = sessionExpiresAt(session.token);
  return expiresAt === null ? null : expiresAt - now;
}

/**
 * Notifies when another tab signs in or out. The `storage` event only fires in
 * tabs other than the one that made the change, which is exactly what we want.
 */
export function subscribeToSessionChanges(listener: (session: Session | null) => void): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key !== null && event.key !== SESSION_KEY) {
      return;
    }
    listener(loadSession());
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/**
 * Teaches the HTTP client how to find the bearer token.
 *
 * Called once during bootstrap rather than from an effect, because React runs
 * child effects before parent effects and a data provider could otherwise fire
 * its first request before the provider was registered.
 */
export function installApiAuthBridge(): void {
  setAuthTokenProvider(() => loadSession()?.token ?? null);
}
