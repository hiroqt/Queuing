import { useEffect, useRef, useState } from "react";
import { servicesApi, visitsApi } from "../../api/client.js";

function clinicTime(instant) {
  if (!instant) return "Walk-in";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(instant));
}

function clinicDateToday() {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date()).filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export default function ReceptionPage() {
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState("");
  const [appointmentAtLocal, setAppointmentAtLocal] = useState("");
  const [visit, setVisit] = useState(null);
  const [lookupCode, setLookupCode] = useState("");
  const [clinicDate, setClinicDate] = useState(clinicDateToday);
  const [loading, setLoading] = useState(true);
  const [serviceLoadFailed, setServiceLoadFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const issueKey = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    servicesApi.available(controller.signal).then((items) => {
      const active = items.filter((item) => item.active !== false);
      setServices(active);
      setServiceId(active[0]?.id ?? "");
    }).catch((cause) => {
      if (cause.name !== "AbortError") {
        setServiceLoadFailed(true);
        setError(cause.message);
      }
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
      const payload = { initialServiceId: serviceId };
      if (appointmentAtLocal) payload.appointmentAtLocal = appointmentAtLocal;
      const issued = await visitsApi.issue(payload, issueKey.current);
      setVisit(issued);
      setLookupCode(issued.visitCode);
      setClinicDate(issued.clinicDate);
      issueKey.current = null;
      setMessage(`Ticket ${issued.ticketNumber ?? issued.visitCode} issued for ${issued.departmentName}.`);
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
      setVisit(await visitsApi.receipt(lookupCode.trim(), clinicDate));
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <section className="reception-page" aria-labelledby="reception-heading">
      <div className="page-heading reception-page-heading">
        <div>
          <p className="eyebrow">RECEPTION DESK</p>
          <h1 id="reception-heading">Issue a visit</h1>
          <p>Choose a service to issue that department’s ticket number and a clinic visit code for lookup.</p>
        </div>
        <aside className="reception-numbering" aria-label="Ticket numbering">
          <span className="eyebrow">TICKET NUMBERING</span>
          <strong>Each department has its own number</strong>
          <span>Resets daily in Asia/Manila; the visit code stays the same when forwarded.</span>
        </aside>
      </div>

      {error && <p className="action-message reception-feedback reception-feedback-error" role="alert">{error}</p>}
      {message && <p className="action-message reception-feedback reception-feedback-success" role="status">{message}</p>}

      <div className="reception-workspace">
        <section className="content-panel reception-issue-panel" aria-labelledby="issue-visit-heading">
          <div className="reception-panel-heading">
            <span className="reception-step" aria-hidden="true">01</span>
            <div>
              <p className="eyebrow">NEW VISIT</p>
              <h2 id="issue-visit-heading">Choose the first service</h2>
              <p className="panel-description">The selected service sets the first department in the patient’s route.</p>
            </div>
          </div>

          <form className="reception-issue-form" onSubmit={issue}>
            <div className="reception-field">
              <label htmlFor="initial-service">First service</label>
              <select id="initial-service" value={serviceId} onChange={(event) => { setServiceId(event.target.value); issueKey.current = null; }} required disabled={loading || pending || services.length === 0}>
                <option value="" disabled>Select a service</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.departmentName} · {service.name}</option>)}
              </select>
            </div>

            <div className="reception-field">
              <label htmlFor="appointment-time">Appointment time <span className="optional-label">Optional</span></label>
              <input id="appointment-time" type="datetime-local" aria-describedby="appointment-hint" value={appointmentAtLocal} onChange={(event) => { setAppointmentAtLocal(event.target.value); issueKey.current = null; }} disabled={pending} />
              <p className="field-hint" id="appointment-hint">Use clinic local time (Asia/Manila). Leave blank for a walk-in.</p>
            </div>

            <button className="button button-dark reception-issue-button" type="submit" disabled={loading || pending || services.length === 0}>
              {pending ? "Issuing…" : "Issue visit"}
            </button>
            {loading && <p className="panel-description" role="status">Loading active services…</p>}
            {!loading && !serviceLoadFailed && services.length === 0 && <p className="reception-empty-services">No active services are available. Ask an administrator to configure one.</p>}
          </form>
        </section>

        <div className="reception-side">
          <section className="content-panel reception-ticket-panel" aria-labelledby="visit-code-heading">
            <div className="reception-panel-title">
              <div>
                <p className="eyebrow">RECEIPT</p>
                <h2 id="visit-code-heading">Latest ticket</h2>
              </div>
              {visit && <span className="reception-issued-tag">Issued</span>}
            </div>

            {visit ? (
              <article className="dashboard-receipt ticket-receipt" aria-labelledby="receipt-title">
                <div className="receipt-heading">
                  <div>
                    <p className="receipt-clinic">CLINIC QUEUE · {visit.clinicDate}</p>
                    <h2 id="receipt-title">Visit receipt</h2>
                  </div>
                  <button className="button button-dark no-print" type="button" onClick={() => window.print()}>Print / reprint</button>
                </div>
                <p className="receipt-number">{visit.ticketNumber ?? visit.visitCode}</p>
                <p className="receipt-service">{visit.serviceName} · {visit.departmentName}</p>
                <p className="receipt-reference">Visit code: {visit.visitCode}</p>
                <p className="receipt-time">Appointment: {clinicTime(visit.appointmentAtUtc)}</p>
                <p className="receipt-note">Listen for your department ticket number. Use the visit code above for receipt lookup.</p>
              </article>
            ) : (
              <div className="reception-ticket-empty">
                <span aria-hidden="true">— — —</span>
                <strong>No ticket loaded</strong>
                <p>Issue a visit or find an existing code to view and print its receipt.</p>
              </div>
            )}
          </section>

          <section className="content-panel reception-lookup-panel" aria-labelledby="lookup-heading">
            <div className="reception-panel-title">
              <div>
                <p className="eyebrow">REPRINT</p>
                <h2 id="lookup-heading">Find a ticket</h2>
              </div>
            </div>
            <p className="panel-description">Enter the visit code and clinic date printed on the receipt.</p>
            <form className="lookup-form" onSubmit={lookup}>
              <div className="reception-field">
                <label htmlFor="visit-lookup">Visit code</label>
                <input id="visit-lookup" value={lookupCode} onChange={(event) => setLookupCode(event.target.value)} required autoComplete="off" />
              </div>
              <div className="reception-field">
                <label htmlFor="clinic-date-lookup">Clinic date</label>
                <input id="clinic-date-lookup" type="date" value={clinicDate} onChange={(event) => setClinicDate(event.target.value)} required />
              </div>
              <button className="button button-quiet reception-find-button" type="submit">Find visit</button>
            </form>
          </section>
        </div>
      </div>
    </section>
  );
}
