import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import { kiosksApi } from "../../../api/client.js";
import AdminFeedback from "../components/AdminFeedback.jsx";
import AdminSectionHeader from "../components/AdminSectionHeader.jsx";

export default function KiosksSection() {
  const { setKioskPairingCode } = useOutletContext();
  const [kiosks, setKiosks] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      setKiosks(await kiosksApi.list(signal));
    } catch (cause) {
      if (cause.name !== "AbortError") setError(cause.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  async function act(action, success) {
    setError("");
    setMessage("");
    try {
      const result = await action();
      setMessage(success);
      await load();
      return result;
    } catch (cause) {
      setError(cause.message);
      return null;
    }
  }

  async function createKiosk(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const kiosk = await act(() => kiosksApi.create({ name: data.get("name").trim() }), "Kiosk registered.");
    if (kiosk) {
      form.reset();
      setShowCreate(false);
    }
  }

  async function pairingCode(kiosk) {
    const result = await act(() => kiosksApi.pairingCode(kiosk.id), `Pairing code created for ${kiosk.name}.`);
    if (result) setKioskPairingCode(result.code ?? "");
  }

  return (
    <section className="content-panel admin-section" aria-labelledby="kiosks-heading">
      <AdminSectionHeader
        id="kiosks-heading"
        eyebrow="PATIENT SELF-SERVICE"
        title="Kiosks"
        countLabel={`${kiosks.length} registered`}
        action={<button className="button button-dark" type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Cancel" : "Add kiosk"}</button>}
      />
      <AdminFeedback error={error} message={message} />
      {loading && <p role="status" className="panel-description">Loading kiosks…</p>}
      {!loading && kiosks.length === 0 && <p className="panel-description">No kiosks are registered. Add a kiosk, then create a one-time pairing code for the device.</p>}
      {showCreate && <form className="admin-inline-form" onSubmit={createKiosk}>
        <h3>Register kiosk</h3>
        <label htmlFor="kiosk-name">Kiosk name</label>
        <input id="kiosk-name" name="name" required minLength="2" maxLength="100" placeholder="e.g. Main lobby" />
        <button className="button button-dark" type="submit">Save kiosk</button>
      </form>}
      <div className="admin-record-list">{kiosks.map((kiosk) => (
        <article className="admin-record" key={kiosk.id}>
          <div className="admin-record-summary">
            <strong>{kiosk.name}</strong>
            <span>{kiosk.active ? kiosk.paired ? "Paired" : "Needs pairing" : "Revoked"}</span>
            <span className="enabled-label">{kiosk.active ? "Active" : "Inactive"}</span>
          </div>
          <div className="admin-form-actions">
            {kiosk.active && <button className="text-button" type="button" onClick={() => pairingCode(kiosk)}>Create pairing code</button>}
            {kiosk.active
              ? <button className="text-button" type="button" onClick={() => act(() => kiosksApi.update(kiosk.id, { active: false }), `${kiosk.name} revoked.`)}>Revoke</button>
              : <button className="text-button" type="button" onClick={() => act(() => kiosksApi.update(kiosk.id, { active: true }), `${kiosk.name} reactivated; create a new pairing code.`)}>Reactivate</button>}
          </div>
        </article>
      ))}</div>
    </section>
  );
}
