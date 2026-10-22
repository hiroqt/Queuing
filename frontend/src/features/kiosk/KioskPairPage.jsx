import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { kioskApi } from "../../api/client.js";
import "./kiosk.css";

export default function KioskPairPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();

  async function pair(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await kioskApi.activate(code.trim().toUpperCase());
      navigate("/kiosk", { replace: true });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="kiosk-shell kiosk-pair-shell">
      <header className="kiosk-header"><a className="kiosk-wordmark" href="/kiosk" aria-label="Clinic queue kiosk"><span className="kiosk-wordmark-mark" aria-hidden="true">Q</span><span>CLINIC QUEUE</span></a><p>DEVICE SETUP</p></header>
      <section className="kiosk-main kiosk-pair-main" aria-labelledby="pair-heading">
        <div className="kiosk-intro"><p className="kiosk-kicker">STAFF SETUP</p><h1 id="pair-heading">Pair this kiosk</h1><p>Enter the one-time code created by your clinic administrator. It expires after 10 minutes.</p></div>
        <form className="kiosk-panel kiosk-pair-panel" onSubmit={pair}>
          <label htmlFor="kiosk-pair-code">Pairing code</label>
          <input id="kiosk-pair-code" name="code" autoComplete="one-time-code" inputMode="text" autoCapitalize="characters" minLength="8" maxLength="20" required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
          {error && <p className="kiosk-inline-error" role="alert">{error}</p>}
          <button className="kiosk-button kiosk-button-primary" type="submit" disabled={pending}>{pending ? "Pairing…" : "Activate kiosk"}</button>
          <p className="kiosk-pair-note">Pairing grants this browser permission to issue anonymous walk-in tickets. Keep it on the clinic’s kiosk device.</p>
        </form>
      </section>
      <footer className="kiosk-footer"><Link to="/kiosk">Return to ticket kiosk</Link><span>Pairing is limited to clinic-issued codes.</span></footer>
    </main>
  );
}
