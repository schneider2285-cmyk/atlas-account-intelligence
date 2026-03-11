import { useState } from "react";

export function AuthGate({ configured, loading, error, info, onSignIn, onSignUp }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (type) => {
    if (!email || !password) return;
    if (type === "signin") {
      await onSignIn(email, password);
      return;
    }
    await onSignUp(email, password);
  };

  if (!configured) {
    return (
      <div className="state-card error">
        <h2>Supabase Auth Not Configured</h2>
        <p>Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`, then restart the dev server.</p>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <p className="atlas-eyebrow">Atlas Secure Access</p>
        <h2>Sign in to load production data</h2>
        <p className="auth-note">
          Production RLS is active, so Atlas now requires an authenticated Supabase user session.
        </p>

        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>

        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>

        <div className="auth-actions">
          <button type="button" onClick={() => submit("signin")} disabled={loading}>
            {loading ? "Working..." : "Sign In"}
          </button>
          <button type="button" onClick={() => submit("signup")} disabled={loading}>
            {loading ? "Working..." : "Create Account"}
          </button>
        </div>

        {error ? <p className="auth-error">{error}</p> : null}
        {info ? <p className="auth-info">{info}</p> : null}
      </section>
    </div>
  );
}
