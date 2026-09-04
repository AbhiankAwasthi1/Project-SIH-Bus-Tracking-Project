import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Button, Callout, TextField } from "../../components/ui";
import { ApiError, toErrorMessage } from "../../services/apiClient";

type LocationState = { from?: string } | null;

/**
 * Sign-in against POST /api/auth/login (the backend's custom signed-token auth).
 *
 * The fields are deliberately empty. They previously shipped with the seeded
 * demo account and its password as default values, which put a plaintext
 * credential in the production bundle. Browser autofill now covers the same
 * convenience via the autoComplete hints below.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, signIn, notice, dismissNotice } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const redirectTo = (location.state as LocationState)?.from || "/";

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    dismissNotice();
    try {
      await signIn(email, password);
      navigate(redirectTo, { replace: true });
    } catch (cause) {
      // Distinguish "wrong credentials" from "the API is unreachable", which is
      // the difference between a user mistake and an environment problem.
      if (cause instanceof ApiError && cause.isOffline) {
        setError(
          "Cannot reach the Drishti API. Check that the backend is running and try again.",
        );
      } else if (cause instanceof ApiError && cause.status === 401) {
        setError("That email and password combination was not accepted.");
      } else {
        setError(toErrorMessage(cause, "Sign-in failed."));
      }
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-center">
      <div className="auth-card">
        <div className="auth-card__brand">
          <h1>Drishti</h1>
          <p>Authority console for SIH26124 &mdash; fleet-sourced urban intelligence.</p>
        </div>

        {notice ? (
          <Callout tone="info" onDismiss={dismissNotice}>
            {notice}
          </Callout>
        ) : null}

        <form className="auth-card__form" onSubmit={onSubmit} noValidate={false}>
          <TextField
            label="Email"
            type="email"
            name="email"
            value={email}
            onValueChange={setEmail}
            autoComplete="email"
            autoFocus
            required
            disabled={busy}
          />
          <TextField
            label="Password"
            type="password"
            name="password"
            value={password}
            onValueChange={setPassword}
            autoComplete="current-password"
            required
            disabled={busy}
          />

          {error ? (
            <Callout tone="error" title="Could not sign in">
              {error}
            </Callout>
          ) : null}

          <Button type="submit" variant="primary" block busy={busy}>
            {busy ? "Signing in" : "Enter console"}
          </Button>
        </form>

        <p className="auth-card__footnote">
          Accounts are provisioned by the Drishti API. If sign-in fails with a connection error,
          the backend is not reachable at <code>/api</code>.
        </p>
      </div>
    </main>
  );
}
