import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "./useAuth.js";
import { homeForRole } from "./roles.js";

export default function SignInPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (auth.loading) return <p className="auth-loading" role="status">Checking your session…</p>;
  if (auth.authenticated) return <Navigate to={auth.user.mustChangePassword ? "/change-password" : homeForRole(auth.user.role)} replace />;

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const user = await auth.login({ userName, password });
      if (!user) throw new Error("Sign-in completed, but the session could not be confirmed. Try again.");
      navigate(user.mustChangePassword ? "/change-password" : location.state?.from ?? homeForRole(user.role), { replace: true });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="content-panel auth-panel" aria-labelledby="signin-heading">
        <Link className="brand auth-brand" to="/login"><span className="brand-mark" aria-hidden="true">q</span><span><strong>Queue</strong><small>CLINIC WORKSPACE</small></span></Link>
        <p className="eyebrow">STAFF ACCESS</p>
        <h1 id="signin-heading">Sign in</h1>
        <p className="panel-description">Use the account provisioned by your clinic administrator.</p>
        {auth.error && <p className="action-message" role="alert">Could not check the existing session: {auth.error}</p>}
        <form onSubmit={submit}>
          <label htmlFor="user-name">Username</label>
          <input id="user-name" name="userName" autoComplete="username" required value={userName} onChange={(event) => setUserName(event.target.value)} />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <p className="action-message" role="alert">{error}</p>}
          <button className="button button-dark" type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="auth-footnote">This clinic queue collects no patient identity information.</p>
      </section>
    </main>
  );
}
