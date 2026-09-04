import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { setUnauthorizedHandler } from "../services/apiClient";
import { login as loginRequest } from "../services/authService";
import type { Session } from "../types";
import {
  clearSession,
  isSessionExpired,
  loadSession,
  millisUntilExpiry,
  saveSession,
  subscribeToSessionChanges,
} from "./session";

export type SignOutReason = "user" | "expired" | "unauthorized";

const SIGN_OUT_NOTICE: Record<Exclude<SignOutReason, "user">, string> = {
  expired: "Your session expired. Sign in again to continue.",
  unauthorized: "Your session is no longer valid. Sign in again to continue.",
};

type AuthContextValue = {
  session: Session | null;
  isAuthenticated: boolean;
  /** Set when a session ended for a reason the operator should see. */
  notice: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: (reason?: SignOutReason) => void;
  dismissNotice: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Discards a stored session that has already expired. */
function readValidSession(): Session | null {
  const stored = loadSession();
  if (!stored) {
    return null;
  }
  if (isSessionExpired(stored)) {
    clearSession();
    return null;
  }
  return stored;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readValidSession);
  const [notice, setNotice] = useState<string | null>(null);

  // Kept in a ref so the sign-out callback stays stable across renders and the
  // registered unauthorized handler never closes over a stale session.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const signOut = useCallback((reason: SignOutReason = "user") => {
    clearSession();
    setSession(null);
    setNotice(reason === "user" ? null : SIGN_OUT_NOTICE[reason]);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await loginRequest(email, password);
    saveSession(next);
    setSession(next);
    setNotice(null);
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  // A 401 from any request means the stored token is no longer accepted.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (sessionRef.current) {
        signOut("unauthorized");
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  // Another tab signing in or out should take effect here too.
  useEffect(
    () =>
      subscribeToSessionChanges((next) => {
        if (!next) {
          setSession(null);
          return;
        }
        setSession(isSessionExpired(next) ? null : next);
      }),
    [],
  );

  // Sign out the moment the token expires instead of waiting for a failed call.
  useEffect(() => {
    if (!session) {
      return;
    }
    const remaining = millisUntilExpiry(session);
    if (remaining === null) {
      return;
    }
    if (remaining <= 0) {
      signOut("expired");
      return;
    }
    // setTimeout saturates above ~24.8 days; the backend issues 24h tokens.
    const timer = window.setTimeout(() => signOut("expired"), Math.min(remaining, 2_147_483_000));
    return () => window.clearTimeout(timer);
  }, [session, signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: session !== null,
      notice,
      signIn,
      signOut,
      dismissNotice,
    }),
    [session, notice, signIn, signOut, dismissNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return value;
}
