import { useEffect, useRef, useState } from "react";
import { servicesApi, visitsApi } from "../../api/client.js";

const TOAST_DURATION_MS = 5000;

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
  const [referenceId, setReferenceId] = useState("");
  const [visit, setVisit] = useState(null);
  const [lookupType, setLookupType] = useState("visitCode");
  const [lookupValue, setLookupValue] = useState("");
  const [receiptMatches, setReceiptMatches] = useState([]);
  const [receiptSearchComplete, setReceiptSearchComplete] = useState(false);
  const [receiptSearchTruncated, setReceiptSearchTruncated] = useState(false);
  const [receiptSearching, setReceiptSearching] = useState(false);
  const [clinicDate, setClinicDate] = useState(clinicDateToday);
  const [loading, setLoading] = useState(true);
  const [serviceLoadFailed, setServiceLoadFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [toastKey, setToastKey] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const remainingTimeRef = useRef(TOAST_DURATION_MS);
  const startTimeRef = useRef(0);
  const timerRef = useRef(null);

  const issueKey = useRef(null);
  const serviceSelectRef = useRef(null);
  const receiptRequestId = useRef(0);

  function clearReceiptSearch() {
    receiptRequestId.current += 1;
    setReceiptSearching(false);
    setReceiptLoading(false);
    setReceiptMatches([]);
    setReceiptSearchComplete(false);
    setReceiptSearchTruncated(false);
  }

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
    }).finally(() => {
      setLoading(false);
      serviceSelectRef.current?.focus();
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!message) {
      remainingTimeRef.current = TOAST_DURATION_MS;
      return;
    }

    if (isHovered) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        remainingTimeRef.current -= (Date.now() - startTimeRef.current);
      }
      return;
    }

    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      setMessage("");
    }, Math.max(remainingTimeRef.current, 500));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message, toastKey, isHovered]);

  useEffect(() => {
    if (!message) return;
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMessage("");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [message]);

  async function issue(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    issueKey.current ??= crypto.randomUUID();
    try {
      const payload = { initialServiceId: serviceId };
      if (appointmentAtLocal) payload.appointmentAtLocal = appointmentAtLocal;
      if (referenceId.trim()) payload.referenceId = referenceId.trim();
      const issued = await visitsApi.issue(payload, issueKey.current);
      clearReceiptSearch();
      setVisit(issued);
      setClinicDate(issued.clinicDate);
      setAppointmentAtLocal("");
      setReferenceId("");
      issueKey.current = null;
      setMessage(`Ticket ${issued.ticketNumber ?? issued.visitCode} issued for ${issued.departmentName}.`);
      setToastKey((prev) => prev + 1);
      remainingTimeRef.current = TOAST_DURATION_MS;
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
    setVisit(null);
    clearReceiptSearch();
    const requestId = ++receiptRequestId.current;
    setReceiptSearching(true);
    const value = lookupValue.trim();
    const normalizedValue = lookupType === "visitCode" && /^\d{1,2}$/.test(value) ? value.padStart(3, "0") : value;
    try {
      const result = await visitsApi.searchReceipts({ lookupType, lookupValue: normalizedValue, clinicDate });
      if (requestId !== receiptRequestId.current) return;
      setReceiptMatches(result.matches);
      setReceiptSearchTruncated(result.truncated);
      setReceiptSearchComplete(true);
    } catch (cause) {
      if (requestId === receiptRequestId.current) setError(cause.message);
    } finally {
      if (requestId === receiptRequestId.current) setReceiptSearching(false);
    }
  }

  async function openReceipt(visitId) {
    setError("");
    const requestId = ++receiptRequestId.current;
    setReceiptLoading(true);
    try {
      const receipt = await visitsApi.getReceipt(visitId);
      if (requestId === receiptRequestId.current) setVisit(receipt);
    } catch (cause) {
      if (requestId === receiptRequestId.current) setError(cause.message);
    } finally {
      if (requestId === receiptRequestId.current) setReceiptLoading(false);
    }
  }

  function clearReceipt() {
    setVisit(null);
    setMessage("");
    setError("");
  }

  const groupedServices = services.reduce((acc, service) => {
    const dept = service.departmentName || "General";
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(service);
    return acc;
  }, {});

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
          <strong>Per department · Resets daily</strong>
          <span>The visit code stays the same when forwarded.</span>
        </aside>
      </div>

      {error && <p className="action-message reception-feedback reception-feedback-error" role="alert">{error}</p>}
      {message && (
        <aside
          key={toastKey}
          className="reception-toast"
          role="status"
          aria-live="polite"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="reception-toast-content">
            <span className="reception-toast-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3.5 8.5l3 3 6-7" />
              </svg>
            </span>
            <span className="reception-toast-message">{message}</span>
            <button
              type="button"
              className="reception-toast-close"
              onClick={() => setMessage("")}
              aria-label="Close notification"
              title="Close notification"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
          <div
            className="reception-toast-progress"
            aria-hidden="true"
            style={{ animationDuration: `${TOAST_DURATION_MS}ms` }}
          />
        </aside>
      )}

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
              <select
                id="initial-service"
                ref={serviceSelectRef}
                value={serviceId}
                onChange={(event) => { setServiceId(event.target.value); issueKey.current = null; }}
                required
                disabled={loading || pending || services.length === 0}
              >
                <option value="" disabled>Select a service</option>
                {Object.entries(groupedServices).map(([dept, items]) => (
                  <optgroup key={dept} label={dept}>
                    {items.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.departmentName} · {service.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {services.length === 0 && !loading && (
                <p className="field-hint" style={{ color: "var(--muted)", marginTop: "6px" }}>
                  No active services are configured yet. Services must be created under <strong>Admin → Services</strong> and assigned to an active department before reception can issue visits.
                </p>
              )}
            </div>

            <div className="reception-field">
              <label htmlFor="appointment-time">Appointment time <span className="optional-label">Optional</span></label>
              <input id="appointment-time" type="datetime-local" aria-describedby="appointment-hint" value={appointmentAtLocal} onChange={(event) => { setAppointmentAtLocal(event.target.value); issueKey.current = null; }} disabled={pending} />
              <p className="field-hint" id="appointment-hint">Use clinic local time (Asia/Manila). Leave blank for a walk-in.</p>
            </div>

            <div className="reception-field">
              <label htmlFor="reference-id">Non-identifying reference <span className="optional-label">Optional</span></label>
              <input
                id="reference-id"
                type="text"
                value={referenceId}
                onChange={(event) => { setReferenceId(event.target.value); issueKey.current = null; }}
                disabled={pending}
                maxLength={50}
                placeholder="e.g. REF-A7"
                aria-describedby="reference-hint"
              />
              <p className="field-hint" id="reference-hint">Use a local code only. Do not enter a chart, patient, or card number.</p>
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
              <div className="reception-ticket-header-actions">
                {visit && (
                  <>
                    <span className={visit.isReprint ? "reception-reprint-tag" : "reception-issued-tag"}>
                      {visit.isReprint ? "Reprint" : "Issued"}
                    </span>
                    <button
                      type="button"
                      className="button-quiet button-sm"
                      onClick={clearReceipt}
                      title="Clear receipt from screen"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>

            {visit ? (
              <article className="dashboard-receipt ticket-receipt print-58mm" aria-labelledby="receipt-title">
                {visit.isReprint && (
                  <div className="receipt-reprint-banner" role="status" aria-label="Reprinted ticket">
                    *** REPRINT ***
                  </div>
                )}
                <div className="receipt-heading">
                  <div>
                    <p className="receipt-clinic">CLINIC QUEUE · {visit.clinicDate}</p>
                    <h2 id="receipt-title">{visit.isReprint ? "Visit receipt (Reprint)" : "Visit receipt"}</h2>
                  </div>
                  <button className="button button-dark no-print" type="button" onClick={() => window.print()}>Print / reprint</button>
                </div>
                <p className="receipt-number">{visit.ticketNumber ?? visit.visitCode}</p>
                <p className="receipt-service">{visit.serviceName} · {visit.departmentName}</p>
                <p className="receipt-reference">Visit code: {visit.visitCode}</p>
                <p className="receipt-time">Appointment: {clinicTime(visit.appointmentAtUtc)}</p>
                <p className="receipt-note">Listen for your department ticket number. Use the visit code or non-identifying reference for lookup.</p>
              </article>
            ) : (
              <div className="reception-ticket-empty">
                <span aria-hidden="true">— — —</span>
                <strong>No ticket loaded</strong>
                <p>Issue a visit or find an existing code below to preview and print its receipt.</p>
              </div>
            )}
          </section>

          <section className="content-panel reception-lookup-panel" aria-labelledby="lookup-heading">
            <div className="reception-panel-title">
              <div>
                <p className="eyebrow">TICKET RECOVERY</p>
                <h2 id="lookup-heading">Find lost ticket</h2>
              </div>
            </div>
            <p className="panel-description">Search by visit code or a non-identifying local reference.</p>
            <form className="lookup-form" onSubmit={lookup}>
              <div className="reception-field">
                <label htmlFor="receipt-lookup-type">Search by</label>
                <select id="receipt-lookup-type" value={lookupType} onChange={(event) => {
                  clearReceiptSearch();
                  setLookupType(event.target.value);
                  setLookupValue("");
                }} disabled={receiptLoading}>
                  <option value="visitCode">Visit code</option>
                  <option value="referenceId">Non-identifying reference</option>
                </select>
              </div>
              <div className="reception-field">
                <label htmlFor="receipt-lookup-value">{lookupType === "visitCode" ? "Visit code" : "Non-identifying reference"}</label>
                <input
                  id="receipt-lookup-value"
                  value={lookupValue}
                  onChange={(event) => { clearReceiptSearch(); setLookupValue(event.target.value); }}
                  required
                  autoComplete="off"
                  inputMode={lookupType === "visitCode" ? "numeric" : "text"}
                  maxLength={lookupType === "visitCode" ? 12 : 50}
                  placeholder={lookupType === "visitCode" ? "e.g. 001 or 1000" : "e.g. REF-A7"}
                  disabled={receiptLoading}
                />
              </div>
              <div className="reception-field">
                <label htmlFor="clinic-date-lookup">Clinic date</label>
                <input id="clinic-date-lookup" type="date" value={clinicDate} onChange={(event) => { clearReceiptSearch(); setClinicDate(event.target.value); }} required disabled={receiptLoading} />
              </div>
              <button className="button button-quiet reception-find-button" type="submit" disabled={receiptLoading || receiptSearching}>{receiptSearching ? "Searching…" : "Find visit"}</button>
            </form>
            {receiptSearchComplete && receiptMatches.length === 0 && <p className="field-hint" role="status">No visits matched that value and clinic date.</p>}
            {receiptMatches.length > 0 && (
              <div className="receipt-match-list" aria-label="Matching visits">
                <p className="field-hint" role="status">{receiptMatches.length === 1 ? "1 visit found. Select it to load the receipt." : `${receiptMatches.length} visits found. Select the correct visit.`}</p>
                {receiptSearchTruncated && <p className="field-hint" role="status">Showing the 100 most recent matches. Narrow the search if you do not see the visit.</p>}
                {receiptMatches.map((match) => (
                  <button
                    className="receipt-match"
                    type="button"
                    key={match.id}
                    disabled={receiptLoading}
                    onClick={() => openReceipt(match.id)}
                  >
                    <strong>{match.ticketNumber} · {match.departmentName}</strong>
                    <span>{match.serviceName || "Previous service"} · Visit {match.visitCode}</span>
                    <span>Issued {clinicTime(match.issuedAtUtc)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
