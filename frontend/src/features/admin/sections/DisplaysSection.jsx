import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router";
import { departmentApi, displaysApi } from "../../../api/client.js";
import AdminFeedback from "../components/AdminFeedback.jsx";
import AdminSectionHeader from "../components/AdminSectionHeader.jsx";

export default function DisplaysSection() {
  const { setPairingCode } = useOutletContext();
  const [departments, setDepartments] = useState([]);
  const [displays, setDisplays] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const [departmentRows, displayRows] = await Promise.all([departmentApi.adminList(signal), displaysApi.list(signal)]);
      setDepartments(departmentRows);
      setDisplays(displayRows);
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

  async function createDisplay(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await act(() => displaysApi.create({
      name: data.get("name").trim(),
      departmentId: data.get("departmentId"),
    }), "Monitor created.");
    if (result) {
      form.reset();
      setShowCreate(false);
    }
  }

  async function issuePairingCode(display) {
    const result = await act(() => displaysApi.pairingCode(display.id), `Pairing code created for ${display.name}.`);
    if (result) setPairingCode(result.code ?? "");
  }

  const activeDepartments = departments.filter((item) => item.active);

  return (
    <section className="content-panel admin-section" aria-labelledby="displays-heading">
      <AdminSectionHeader
        id="displays-heading"
        eyebrow="WAITING ROOM DEVICES"
        title="Displays"
        countLabel={`${displays.length} registered`}
        action={<button className="button button-dark" type="button" onClick={() => setShowCreate((value) => !value)} disabled={activeDepartments.length === 0}>{showCreate ? "Cancel" : "Add monitor"}</button>}
      />
      <AdminFeedback error={error} message={message} />
      {loading && <p role="status" className="panel-description">Loading displays…</p>}
      {!loading && activeDepartments.length === 0 && <p className="panel-description">Add an active department before registering a monitor. <Link to="/admin/departments">Go to Departments</Link></p>}
      {!loading && activeDepartments.length > 0 && displays.length === 0 && <p className="panel-description">No monitors are registered yet. Add a monitor and create a pairing code to activate its display.</p>}
      {showCreate && <form className="admin-inline-form" onSubmit={createDisplay}>
        <h3>Register monitor</h3>
        <label htmlFor="display-name">Monitor name</label>
        <input id="display-name" name="name" required minLength="2" maxLength="100" />
        <label htmlFor="display-department">Assigned department</label>
        <select id="display-department" name="departmentId" required defaultValue="">
          <option value="" disabled>Select a department</option>
          {activeDepartments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button className="button button-dark" type="submit">Save monitor</button>
      </form>}
      <div className="admin-record-list">{displays.map((display) => (
        <article className="admin-record" key={display.id}>
          <div className="admin-record-summary">
            <strong>{display.name}</strong>
            <span>{departments.find((item) => item.id === display.departmentId)?.name ?? "Department unavailable"}</span>
            <span className="enabled-label">{display.active ? "Active" : "Revoked"}</span>
          </div>
          <div className="admin-form-actions">
            <button className="text-button" type="button" onClick={() => issuePairingCode(display)} disabled={!display.active}>Create pairing code</button>
            {display.active && <button className="text-button" type="button" onClick={() => act(() => displaysApi.update(display.id, { active: false }), `${display.name} revoked.`)}>Revoke</button>}
          </div>
        </article>
      ))}</div>
    </section>
  );
}
