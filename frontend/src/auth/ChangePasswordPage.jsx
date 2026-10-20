import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "./useAuth.js";
import { homeForRole } from "./roles.js";

export default function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("The new password and confirmation do not match.");
      return;
    }
    setPending(true);
    try {
      const updatedUser = await changePassword({ currentPassword, newPassword });
      if (!updatedUser || updatedUser.mustChangePassword) throw new Error("The server has not confirmed the password change. Try again.");
      navigate(homeForRole(updatedUser.role), { replace: true });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (cause) {
      setError(cause.message);
    }
  }

  return <main className="auth-page"><section className="content-panel auth-panel" aria-labelledby="change-password-heading"><p className="eyebrow">FIRST SIGN-IN</p><h1 id="change-password-heading">Change your password</h1><p className="panel-description">Your administrator issued a temporary credential. Set a private password before using the clinic queue.</p><p className="auth-footnote">Signed in as {user.userName}. Queue operations stay unavailable until this change is confirmed.</p><form onSubmit={submit}><label htmlFor="current-password">Temporary password</label><input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /><label htmlFor="new-password">New password</label><input id="new-password" name="newPassword" type="password" autoComplete="new-password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />{error && <p className="action-message" role="alert">{error}</p>}<button className="button button-dark" type="submit" disabled={pending}>{pending ? "Updating…" : "Change password"}</button><button className="button button-quiet auth-signout" type="button" disabled={pending} onClick={signOut}>Sign out</button></form></section></main>;
}
