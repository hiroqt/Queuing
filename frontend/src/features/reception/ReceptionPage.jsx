import { useEffect, useRef, useState } from "react";
import { departmentApi, visitsApi } from "../../api/client.js";

function clinicTime(instant) {
  if (!instant) return "Walk-in";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(instant));
}

export default function ReceptionPage() {
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState("");
  const [appointmentAtLocal, setAppointmentAtLocal] = useState("");
  const [visit, setVisit] = useState(null);
  const [lookupId, setLookupId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const issueKey = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    departmentApi.list(controller.signal).then((items) => {
      const active = items.filter((item) => item.active !== false);
      setDepartments(active);
      setDepartmentId(active[0]?.id ?? "");
    }).catch((cause) => {
      if (cause.name !== "AbortError") setError(cause.message);
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  async function issue(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    issueKey.current ??= crypto.randomUUID();
    try {
      const payload = { initialDepartmentId: departmentId };
      if (appointmentAtLocal) payload.appointmentAtLocal = appointmentAtLocal;
      const issued = await visitsApi.issue(payload, issueKey.current);
      setVisit(issued);
      setLookupId(issued.id);
      issueKey.current = null;
      setMessage(`Visit ${issued.visitCode} issued. Keep this code for the whole clinic visit.`);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setPending(false);
    }
  }

  async function lookup(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      setVisit(await visitsApi.get(lookupId.trim()));
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <section aria-labelledby="reception-heading">
      <div className="page-heading"><div><p className="eyebrow">RECEPTION</p><h1 id="reception-heading">Issue a visit</h1><p>Create one stable visit code. Forwarding between departments will not issue another code.</p></div><span className="surface-tag">No patient identity fields</span></div>
      {error && <p className="action-message" role="alert">{error}</p>}
      {message && <p className="action-message" role="status">{message}</p>}
      <div className="ticket-layout">
        <section className="content-panel issue-panel" aria-labelledby="issue-visit-heading">
          <p className="eyebrow">NEW VISIT</p><h2 id="issue-visit-heading">Queue details</h2>
          <p className="panel-description">The server assigns the clinic-wide daily code. Appointments are entered in the clinic timezone, Asia/Manila.</p>
          <form onSubmit={issue}>
            <label htmlFor="initial-department">First department</label>
            <select id="initial-department" value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); issueKey.current = null; }} required disabled={loading || pending || departments.length === 0}><option value="" disabled>Select a department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
            <label htmlFor="appointment-time">Appointment time <span className="optional-label">Optional</span></label>
            <input id="appointment-time" type="datetime-local" aria-describedby="appointment-hint" value={appointmentAtLocal} onChange={(event) => { setAppointmentAtLocal(event.target.value); issueKey.current = null; }} disabled={pending} />
            <p className="field-hint" id="appointment-hint">Enter clinic local time (Asia/Manila). Leave blank for a walk-in.</p>
            <button className="button button-dark" type="submit" disabled={loading || pending || departments.length === 0}>{pending ? "Issuing…" : "Issue visit"}</button>
            {loading && <p className="panel-description" role="status">Loading active departments…</p>}
            {!loading && departments.length === 0 && <p className="panel-description">No active departments are available. Ask an administrator to configure one.</p>}
          </form>
        </section>

        <section className="ticket-preview-area" aria-labelledby="visit-code-heading">
          <div className="section-heading"><div><p className="eyebrow">RECEIPT</p><h2 id="visit-code-heading">Visit code</h2></div><span className="count-label">Reprint authorized</span></div>
          {visit ? <article className="dashboard-receipt ticket-receipt" aria-labelledby="receipt-title"><div className="receipt-heading"><div><p className="eyebrow">CLINIC QUEUE</p><h2 id="receipt-title">Your visit</h2></div><button className="button button-dark no-print" type="button" onClick={() => window.print()}>Print / reprint</button></div><p className="receipt-number">{visit.visitCode}</p><p className="receipt-service">{departments.find((department) => department.id === visit.departmentId)?.name ?? "Clinic visit"}</p><p className="receipt-time">Appointment: {clinicTime(visit.appointmentAtUtc)}</p><p className="receipt-note">Keep this same visit code as you move between clinic departments.</p></article> : <p className="panel-description">A valid visit code will appear here after server confirmation.</p>}
          <form className="lookup-form" onSubmit={lookup}><label htmlFor="visit-lookup">Reprint an existing visit by ID</label><input id="visit-lookup" value={lookupId} onChange={(event) => setLookupId(event.target.value)} required autoComplete="off" /><button className="button button-quiet" type="submit">Find visit</button></form>
        </section>
      </div>
    </section>
  );
}
