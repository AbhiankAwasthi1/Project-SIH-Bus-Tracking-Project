import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginRequest, saveSession } from "../api";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("authority@drishti.city");
  const [password, setPassword] = useState("sih26124");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await loginRequest(email, password);
      saveSession(session);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <h1>Drishti</h1>
        <p>Authority console for SIH26124 — fleet-sourced urban intelligence.</p>
        <form onSubmit={onSubmit}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
          {error ? <div className="error">{error}</div> : null}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Enter map"}
          </button>
        </form>
      </div>
    </div>
  );
}
