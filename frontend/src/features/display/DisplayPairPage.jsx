import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { displaysApi } from "../../api/client.js";

export default function DisplayPairPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();

  async function pair(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await displaysApi.activate(code.trim());
      navigate(result.displayType === "Lobby" ? "/display/lobby" : "/display", { replace: true });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setPending(false);
    }
  }

  return <main className="auth-page"><section className="content-panel auth-panel" aria-labelledby="pair-heading"><Link className="brand auth-brand" to="/login"><span className="brand-mark" aria-hidden="true">q</span><span><strong>Queue</strong><small>CLINIC DISPLAY</small></span></Link><p className="eyebrow">MONITOR SETUP</p><h1 id="pair-heading">Pair this display</h1><p className="panel-description">Enter the one-time code generated for this display by your clinic administrator.</p><form onSubmit={pair}><label htmlFor="pairing-code">Pairing code</label><input id="pairing-code" name="code" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value)} /><p className="field-hint">This activates a read-only display for its configured scope.</p>{error && <p className="action-message" role="alert">{error}</p>}<button className="button button-dark" type="submit" disabled={pending}>{pending ? "Pairing…" : "Activate display"}</button></form></section></main>;
}
