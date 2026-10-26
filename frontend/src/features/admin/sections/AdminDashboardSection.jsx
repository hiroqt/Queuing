import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { adminDashboardApi } from "../../../api/client.js";

const REFRESH_INTERVAL_MS = 15_000;
const REQUEST_TIMEOUT_MS = 10_000;

const dashboardSections = [
  { key: "departments", path: "/admin/departments", label: "Departments" },
  { key: "services", path: "/admin/services", label: "Services" },
  { key: "stations", path: "/admin/stations", label: "Stations" },
  { key: "users", path: "/admin/users", label: "Users & access" },
  { key: "displays", path: "/admin/displays", label: "Displays" },
  { key: "kiosks", path: "/admin/kiosks", label: "Kiosks" },
];

function clinicTime(value) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value));
}

export default function AdminDashboardSection() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const loaded = useRef(false);
  const inFlight = useRef(null);
  const requestController = useRef(null);

  const refresh = useCallback(async (signal, refreshConfiguration = false) => {
    if (inFlight.current === signal) return;
    inFlight.current = signal;
    setError("");
    setLoading(!loaded.current);
    setRefreshing(loaded.current);
    let timedOut = false;
    const fetchController = new AbortController();
    const abortForUnmount = () => fetchController.abort();
    signal?.addEventListener("abort", abortForUnmount, { once: true });
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      fetchController.abort();
    }, REQUEST_TIMEOUT_MS);
    try {
      const includeConfiguration = refreshConfiguration || !loaded.current;
      const result = await adminDashboardApi.summary(fetchController.signal, refreshConfiguration, includeConfiguration);
      if (inFlight.current === signal && !signal?.aborted) {
        setSummary((current) => current ? { ...current, ...result } : result);
        loaded.current = true;
      }
    } catch {
      if (!signal?.aborted && inFlight.current === signal) {
        setError(loaded.current
          ? timedOut ? "This refresh took too long. Your last dashboard data is still shown. Try again shortly."
            : "Refresh failed. Your last dashboard data is still shown. We’ll try again automatically."
          : timedOut ? "The dashboard took too long to load. Check that the backend is running, then try again."
            : "Make sure the backend is running. If it is already running, restart it, then try again.");
      }
    } finally {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abortForUnmount);
      if (inFlight.current === signal) {
        inFlight.current = null;
      }
      if (inFlight.current === null && !signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    requestController.current = controller;
    const run = () => void refresh(controller.signal);
    run();
    const interval = window.setInterval(run, REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      controller.abort();
      if (requestController.current === controller) requestController.current = null;
    };
  }, [refresh]);

  const setupItems = summary ? [
    { count: summary.setupChecks.departmentsWithoutActiveServices, label: "Departments need an active service", path: "/admin/departments" },
    { count: summary.setupChecks.stationsWithoutActiveStaff, label: "Stations have no staff assigned", path: "/admin/stations" },
  ].filter((item) => item.count > 0) : [];

  return (
    <section className="admin-dashboard" aria-labelledby="admin-dashboard-heading">
      <div className="admin-dashboard-heading">
        <div>
          <p className="eyebrow">AT A GLANCE</p>
          <h2 id="admin-dashboard-heading">Your clinic</h2>
          <p>Manage setup and see how each department’s queue is moving.</p>
        </div>
        {(summary || !error) && <button className="button button-quiet" type="button" onClick={() => void refresh(requestController.current?.signal, true)} disabled={loading || refreshing}>
          {refreshing ? "Refreshing…" : "Refresh overview"}
        </button>}
      </div>

      {error && <div className={`admin-dashboard-error${summary ? " has-summary" : ""}`} role="alert">
        <span className="admin-dashboard-error-mark" aria-hidden="true">!</span>
        <div><strong>{summary ? "Dashboard couldn’t refresh" : "Dashboard data isn’t available"}</strong><p>{error}</p></div>
        {!summary && <button className="button button-quiet" type="button" onClick={() => void refresh(requestController.current?.signal)} disabled={loading || refreshing}>
          {loading ? "Trying again…" : "Try again"}
        </button>}
      </div>}
      {loading && <p className="panel-description" role="status">Loading your dashboard…</p>}
      {summary && <>
        <section className="admin-dashboard-panel" aria-labelledby="admin-setup-heading">
          <div className="admin-dashboard-panel-heading">
            <div><p className="eyebrow">CONFIGURATION</p><h3 id="admin-setup-heading">Clinic setup</h3></div>
            <span className="count-label">Setup counts refreshed {clinicTime(summary.configurationUpdatedAtUtc)} · active displays are live</span>
          </div>
          <div className="admin-dashboard-section-grid">
            {dashboardSections.map(({ key, path, label }) => {
              const counts = summary[key];
              return <Link className="admin-dashboard-summary" key={key} to={path}>
                <span className="admin-dashboard-summary-label">{label}<span aria-hidden="true">↗</span></span>
                <span className="admin-dashboard-summary-main"><strong>{counts.active}</strong><span>{key === "displays" ? "Active · live" : "Active"}</span></span>
                <span className="admin-dashboard-summary-meta">
                  <span><strong>{counts.total}</strong>Total</span>
                  <span><strong>{counts.inactive}</strong>Inactive</span>
                </span>
                <span className="admin-dashboard-summary-action">Manage {label}</span>
              </Link>;
            })}
          </div>
        </section>

        <div className="admin-dashboard-lower-grid">
          <section className="admin-dashboard-panel" aria-labelledby="admin-queue-heading">
            <div className="admin-dashboard-panel-heading">
              <div><p className="eyebrow">QUEUE ACTIVITY</p><h3 id="admin-queue-heading">Queues right now</h3></div>
              <span className="count-label">Live · displays and queues · {clinicTime(summary.updatedAtUtc)}</span>
            </div>
            <div className="admin-dashboard-queue-totals">
              <p><strong>{summary.queue.waitingCount}</strong><span>Waiting</span></p>
              <p><strong>{summary.queue.calledCount}</strong><span>Currently called</span></p>
            </div>
            {summary.queue.departments.length > 0
              ? <ul className="admin-dashboard-department-queues">
                {summary.queue.departments.map((department) => <li key={department.departmentId}>
                  <strong>{department.departmentName}</strong>
                  <span>{department.waitingCount} waiting</span>
                  <span>{department.calledCount} currently called</span>
                </li>)}
              </ul>
              : <p className="panel-description">No departments yet. <Link to="/admin/departments">Add a department</Link> to see queue activity here.</p>}
            <p className="admin-dashboard-privacy-note">This overview shows totals. Open a department queue to see ticket details.</p>
          </section>

          <section className="admin-dashboard-panel" aria-labelledby="admin-attention-heading">
            <div className="admin-dashboard-panel-heading">
              <div><p className="eyebrow">REVIEW</p><h3 id="admin-attention-heading">Items to review</h3></div>
            </div>
            {setupItems.length > 0
              ? <ul className="admin-dashboard-attention-list">{setupItems.map((item) => <li key={item.path}>
                <span><strong>{item.count}</strong> {item.label}</span><Link to={item.path}>Take a look</Link>
              </li>)}</ul>
              : <p className="panel-description">Your setup looks good. Nothing needs review right now.</p>}
          </section>
        </div>
      </>}
    </section>
  );
}
