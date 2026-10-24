import { useCallback, useEffect, useRef, useState } from "react";
import { departmentApi, queueApi, servicesApi } from "../../api/client.js";
import { useAuth } from "../../auth/useAuth.js";

const EMPTY_DEPARTMENT_IDS = [];

function clinicTime(value) {
  return value ? new Intl.DateTimeFormat("en-PH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value)) : "Walk-in";
}

export default function DepartmentQueuePage() {
  const { user } = useAuth();
  const assignedIds = user.departmentIds ?? EMPTY_DEPARTMENT_IDS;
  const [departments, setDepartments] = useState([]);
  const [services, setServices] = useState([]);
  const [departmentId, setDepartmentId] = useState(assignedIds[0] ?? "");
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [forwardOptions, setForwardOptions] = useState({});
  const operationKeys = useRef(new Map());

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => Promise.all([departmentApi.list(controller.signal), servicesApi.available(controller.signal)])).then(([items, serviceItems]) => {
      const active = items.filter((item) => item.active !== false);
      setDepartments(active);
      setServices(serviceItems.filter((item) => item.active !== false));
      const allowed = active.filter((item) => assignedIds.includes(item.id));
      setDepartmentId((current) => allowed.some((item) => item.id === current) ? current : allowed[0]?.id ?? "");
    }).catch((cause) => {
      if (cause.name !== "AbortError") setError(cause.message);
    });
    return () => controller.abort();
  }, [assignedIds]);

  const refresh = useCallback(async (signal) => {
    if (!departmentId) { setSnapshot(null); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      setSnapshot(await queueApi.get(departmentId, signal));
    } catch (cause) {
      if (cause.name !== "AbortError") setError(cause.message);
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => refresh(controller.signal));
    return () => controller.abort();
  }, [refresh]);

  function idempotencyKey(signature) {
    if (!operationKeys.current.has(signature)) operationKeys.current.set(signature, crypto.randomUUID());
    return operationKeys.current.get(signature);
  }

  async function mutate(action, success, signature) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const resultMessage = await action();
      operationKeys.current.delete(signature);
      setMessage(resultMessage || success);
      await refresh();
    } catch (cause) {
      if (cause.status === 409) operationKeys.current.delete(signature);
      setError(cause.message);
    } finally {
      setPending(false);
    }
  }

  async function callNext() {
    const signature = `call:${departmentId}`;
    await mutate(async () => {
      const visit = await queueApi.callNext(departmentId, idempotencyKey(signature));
      return `Now calling ${visit.ticketNumber ?? visit.visitCode}.`;
    }, "Call completed.", signature);
  }

  async function returnToPending(visit) {
    const signature = `pending:${visit.id}`;
    await mutate(() => queueApi.returnToPending(visit.id, idempotencyKey(signature)), `${visit.ticketNumber ?? visit.visitCode} returned to pending.`, signature);
  }

  async function complete(event, visit) {
    event.preventDefault();
    const options = forwardOptions[visit.id] ?? {};
    const nextServiceId = options.nextServiceId || null;
    const appointmentAtLocal = options.appointmentAtLocal || null;
    const signature = `complete:${visit.id}:${nextServiceId ?? ""}:${appointmentAtLocal ?? ""}`;
    await mutate(
      async () => {
        const result = await queueApi.complete(visit.id, nextServiceId, appointmentAtLocal, idempotencyKey(signature));
        return nextServiceId
          ? `Forwarded with destination ticket ${String(result.nextDepartmentTicketNumber).padStart(3, "0")}.`
          : `${visit.ticketNumber ?? visit.visitCode} completed.`;
      },
      "Queue updated.",
      signature,
    );
  }

  const assignedDepartments = departments.filter((department) => assignedIds.includes(department.id));
  const currentDepartment = assignedDepartments.find((department) => department.id === departmentId);
  const waiting = snapshot?.waiting ?? [];
  const called = snapshot?.called ?? [];

  return (
    <section aria-labelledby="department-heading">
      <div className="page-heading"><div><p className="eyebrow">DEPARTMENT STAFF</p><h1 id="department-heading">Department queue</h1><p>Call eligible visits, return no-shows to pending, or complete and forward a visit.</p></div><span className="surface-tag">Assigned Services only</span></div>
      {assignedDepartments.length > 1 && <div className="department-picker"><label htmlFor="assigned-department">Your department</label><select id="assigned-department" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}><option value="" disabled>Select a department</option>{assignedDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>}
      {!assignedDepartments.length && <p className="action-message" role="alert">No active department assignments are available for this account.</p>}
      {error && <p className="action-message" role="alert">{error}</p>}
      {message && <p className="action-message" role="status">{message}</p>}
      <div className="staff-layout">
        <div className="staff-main">
          <section className="current-call" aria-labelledby="called-heading"><div className="current-call-copy"><p className="eyebrow eyebrow-light">{currentDepartment?.name ?? "ASSIGNED DEPARTMENT"} · CURRENTLY CALLED</p><h2 id="called-heading">{called[0]?.ticketNumber ?? called[0]?.visitCode ?? "—"}</h2><p>{called[0] ? `Appointment: ${clinicTime(called[0].appointmentAtUtc)}` : "No visit is currently called."}</p></div><div className="call-actions"><button className="button button-primary" type="button" onClick={callNext} disabled={pending || loading || !departmentId}>{pending ? "Calling…" : "Call next"}</button></div></section>
          {loading && <p className="panel-description" role="status">Loading the authorized queue…</p>}
          <section className="queue-section" aria-labelledby="waiting-heading"><div className="section-heading"><div><p className="eyebrow">AUTHORIZED SNAPSHOT</p><h2 id="waiting-heading">Waiting visits</h2></div><span className="count-label"><strong>{waiting.length.toString().padStart(2, "0")}</strong> waiting</span></div><div className="queue-table-wrap"><table className="queue-table"><caption className="visually-hidden">Waiting visits in assigned Services</caption><thead><tr><th scope="col">Department ticket</th><th scope="col">Service</th><th scope="col">Appointment</th><th scope="col">Issued</th></tr></thead><tbody>{waiting.length ? waiting.map((visit) => <tr key={visit.id}><th scope="row"><span className="ticket-number">{visit.ticketNumber ?? visit.visitCode}</span></th><td>{visit.serviceName ?? "Legacy department queue"}</td><td>{clinicTime(visit.appointmentAtUtc)}</td><td>{clinicTime(visit.issuedAtUtc)}</td></tr>) : <tr><td className="empty-queue" colSpan="4">{loading ? "Loading visits…" : "No visits are waiting."}</td></tr>}</tbody></table></div></section>
        </div>
        <aside className="staff-aside" aria-label="Currently called visits"><section className="detail-panel"><p className="eyebrow">CALLS IN THIS DEPARTMENT</p>{called.length === 0 && <p className="panel-description">No active calls.</p>}{called.map((visit) => {
          const options = forwardOptions[visit.id] ?? { nextServiceId: "", appointmentAtLocal: "" };
          return <article className="called-visit" key={visit.id}><strong>{visit.ticketNumber ?? visit.visitCode}</strong><span>{visit.serviceName ?? "Legacy department queue"} · {clinicTime(visit.appointmentAtUtc)}</span><button className="text-button" type="button" disabled={pending} onClick={() => returnToPending(visit)}>Return no-show to pending</button><form onSubmit={(event) => complete(event, visit)}><label htmlFor={`next-${visit.id}`}>Forward to service</label><select id={`next-${visit.id}`} value={options.nextServiceId} onChange={(event) => setForwardOptions((current) => ({ ...current, [visit.id]: { ...current[visit.id], nextServiceId: event.target.value, appointmentAtLocal: event.target.value ? current[visit.id]?.appointmentAtLocal ?? "" : "" } }))}><option value="">Complete visit</option>{services.filter((service) => service.departmentId !== departmentId).map((service) => <option key={service.id} value={service.id}>{service.departmentName} · {service.name}</option>)}</select><label htmlFor={`appointment-${visit.id}`}>Next service appointment (optional)</label><input id={`appointment-${visit.id}`} type="datetime-local" value={options.appointmentAtLocal} disabled={!options.nextServiceId} aria-describedby={`appointment-help-${visit.id}`} onChange={(event) => setForwardOptions((current) => ({ ...current, [visit.id]: { ...current[visit.id], appointmentAtLocal: event.target.value } }))} /><span id={`appointment-help-${visit.id}`} className="panel-description">Clinic local time (Asia/Manila); blank keeps it as a walk-in.</span><button className="button button-dark" type="submit" disabled={pending}>{pending ? "Saving…" : "Complete / forward"}</button></form></article>;
        })}</section></aside>
      </div>
    </section>
  );
}
