import { useState } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff } from "lucide-react";
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
  const [visible, setVisible] = useState({});
  const requirements = [
    ["At least 12 characters", newPassword.length >= 12],
    ["One lowercase letter", /\p{Ll}/u.test(newPassword)],
    ["One uppercase letter", /\p{Lu}/u.test(newPassword)],
    ["One number", /\p{Nd}/u.test(newPassword)],
    ["One symbol (such as ! or #)", /[^\p{L}\p{N}]/u.test(newPassword)],
  ];
  const passwordValid = requirements.every(([, met]) => met);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!passwordValid || !passwordsMatch) {
      setError("Complete the password requirements and make sure both passwords match.");
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

  const passwordField = (id, label, value, setValue, autoComplete) => <><label htmlFor={id}>{label}</label><div className="password-input"><input id={id} name={id} type={visible[id] ? "text" : "password"} autoComplete={autoComplete} required value={value} onChange={(event) => setValue(event.target.value)} /><button className="password-visibility" type="button" aria-label={visible[id] ? "Hide entered characters" : "Show entered characters"} aria-controls={id} onClick={() => setVisible((previous) => ({ ...previous, [id]: !previous[id] }))}>{visible[id] ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></>;
  return <main className="auth-page"><section className="content-panel auth-panel" aria-labelledby="change-password-heading"><p className="eyebrow">FIRST SIGN-IN</p><h1 id="change-password-heading">Change your password</h1><p className="panel-description">Your administrator issued a temporary credential. Set a private password before using the clinic queue.</p><p className="auth-footnote">Signed in as {user.userName}. Queue operations stay unavailable until this change is confirmed.</p><form onSubmit={submit}>{passwordField("current-password", "Temporary password", currentPassword, setCurrentPassword, "current-password")}{passwordField("new-password", "New password", newPassword, setNewPassword, "new-password")}<ul className="password-requirements" aria-live="polite" aria-label="Password requirements">{requirements.map(([text, met]) => <li key={text} className={met ? "met" : "unmet"}><span aria-hidden="true">{met ? "✓" : "•"}</span>{text}</li>)}</ul>{passwordField("confirm-password", "Confirm new password", confirmPassword, setConfirmPassword, "new-password")}{confirmPassword && <p className={`field-hint ${passwordsMatch ? "password-match" : "password-unmatch"}`} aria-live="polite">{passwordsMatch ? "Passwords match." : "Passwords do not match yet."}</p>}{error && <p className="action-message" role="alert">{error}</p>}<button className="button button-dark" type="submit" disabled={pending || !passwordValid || !passwordsMatch}>{pending ? "Updating…" : "Change password"}</button><button className="button button-quiet auth-signout" type="button" disabled={pending} onClick={signOut}>Sign out</button></form></section></main>;
}
