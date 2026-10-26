import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router";
import { kiosksApi } from "../../../api/client.js";
import AdminActions from "../components/AdminActions.jsx";
import AdminDialog from "../components/AdminDialog.jsx";
import AdminFeedback from "../components/AdminFeedback.jsx";
import AdminListControls from "../components/AdminListControls.jsx";
import AdminSectionHeader from "../components/AdminSectionHeader.jsx";
import AdminStatusBadge from "../components/AdminStatusBadge.jsx";

export default function KiosksSection() {
  const { setOneTimeNotice } = useOutletContext();
  const [kiosks, setKiosks] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
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
    if (result?.code) setOneTimeNotice({
      kind: "kiosk",
      title: "Kiosk pairing code",
      itemName: kiosk.name,
      secret: result.code,
      guidance: "Enter this one-time code on the kiosk device. It expires in 10 minutes.",
      href: "/kiosk/pair",
      linkLabel: "Open kiosk pairing page in a new tab",
    });
  }

  return (
    <section className="content-panel admin-section" aria-labelledby="kiosks-heading">
      <AdminSectionHeader
        id="kiosks-heading"
        eyebrow="PATIENT SELF-SERVICE"
        title="Kiosks"
        countLabel={`${kiosks.length} registered`}
        action={<button className="button button-dark" type="button" onClick={() => setShowCreate(true)} disabled={loading}>Add kiosk</button>}
      />
      <AdminFeedback error={showCreate ? "" : error} message={message} />
      {loading && <p role="status" className="panel-description">Loading kiosks…</p>}
      {!loading && kiosks.length === 0 && <p className="panel-description">No kiosks are registered. Add a kiosk, then create a one-time pairing code for the device.</p>}
      {showCreate && <AdminDialog title="Register kiosk" onClose={() => setShowCreate(false)} busy={submitting}>
        <form onSubmit={createKiosk}>
          <label htmlFor="kiosk-name">Kiosk name</label>
          <input id="kiosk-name" name="name" required minLength="2" maxLength="100" placeholder="e.g. Main lobby" autoFocus />
          {error && <p className="action-message" role="alert">{error}</p>}
          <div className="admin-form-actions"><button className="button button-dark" type="submit" disabled={submitting}>{submitting ? "Saving kiosk…" : "Save kiosk"}</button><button className="button button-quiet" type="button" onClick={() => setShowCreate(false)} disabled={submitting}>Cancel</button></div>
        </form>
      </AdminDialog>}
      {kiosks.length > 0 && <AdminListControls items={kiosks} searchLabel="kiosks" getSearchText={(kiosk) => `${kiosk.name} ${kiosk.active ? kiosk.paired ? "paired" : "needs pairing" : "revoked"}`} getStatus={(item) => item.active ? "active" : "inactive"}>
        {(filteredKiosks) => <div className="admin-record-list">{filteredKiosks.map((kiosk) => (
          <article className="admin-record" key={kiosk.id}>
            <div className="admin-record-summary"><strong>{kiosk.name}</strong><AdminStatusBadge status={kiosk.active ? "active" : "revoked"} /></div>
            <div className="admin-record-details"><span>{kiosk.active ? kiosk.paired ? "Paired" : "Needs pairing" : "Revoked"}</span></div>
            <AdminActions>
              {kiosk.active && <button className="text-button" type="button" disabled={submitting} onClick={() => pairingCode(kiosk)}>Create pairing code</button>}
              <button className="text-button" type="button" disabled={submitting} onClick={() => {
                const active = !kiosk.active;
                return act(() => kiosksApi.update(kiosk.id, { active }), `${kiosk.name} ${active ? "reactivated; create a new pairing code" : "revoked"}.`);
              }}>{kiosk.active ? "Revoke kiosk" : "Reactivate kiosk"}</button>
            </AdminActions>
          </article>
        ))}</div>}
      </AdminListControls>}
    </section>
  );
}
