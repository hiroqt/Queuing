import { useCallback, useEffect, useState } from "react";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { Link, useNavigate } from "react-router";
import { displaysApi, refreshRequestToken } from "../../api/client.js";

export default function PairedDisplayPage() {
  const [snapshot, setSnapshot] = useState(null);
  const [connection, setConnection] = useState("connecting");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const refresh = useCallback(async (signal) => {
    try {
      setSnapshot(await displaysApi.snapshot(signal));
      setError("");
    } catch (cause) {
      if (cause.name !== "AbortError") setError(cause.status === 401 || cause.status === 403 ? "This monitor is not paired or its access was revoked." : cause.message);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const hub = new HubConnectionBuilder().withUrl("/hubs/displays", { withCredentials: true }).withAutomaticReconnect([0, 2000, 5000, 10000]).configureLogging(LogLevel.Warning).build();
    const reload = () => { if (active) void refresh(controller.signal); };
    hub.on("QueueChanged", reload);
    hub.on("DisplayRevoked", () => {
      if (!active) return;
      setSnapshot(null);
      setError("This monitor is not paired or its access was revoked.");
      setConnection("disconnected");
      void hub.stop();
    });
    hub.onreconnecting(() => active && setConnection("reconnecting"));
    hub.onreconnected(() => { if (active) { setConnection("connected"); reload(); } });
    hub.onclose(() => active && setConnection("disconnected"));
    Promise.resolve().then(() => active && refresh(controller.signal));
    hub.start().then(() => {
      if (active) { setConnection("connected"); reload(); }
    }).catch(() => active && setConnection("disconnected"));
    const retry = window.setInterval(() => {
      if (hub.state !== "Connected") {
        reload();
        if (hub.state === "Disconnected") hub.start().then(() => active && setConnection("connected")).catch(() => {});
      }
    }, 10000);
    return () => {
      active = false;
      window.clearInterval(retry);
      controller.abort();
      void hub.stop();
    };
  }, [refresh]);

  async function unpair() {
    try {
      await refreshRequestToken();
      await displaysApi.logout();
      navigate("/display/pair", { replace: true });
    } catch (cause) {
      setError(cause.message);
    }
  }

  const current = snapshot?.called?.[0] ?? null;
  const waiting = snapshot?.waiting ?? [];

  return <main className="paired-display-page"><header className="paired-display-header"><div><p className="eyebrow eyebrow-light">CLINIC QUEUE</p><h1>{snapshot?.departmentName ?? "Department display"}</h1><p>Assigned department · read-only monitor</p></div><div className="display-connection"><span className={`connection-dot connection-${connection}`} aria-hidden="true" />Connection: {connection}</div><button className="button button-quiet" type="button" onClick={unpair}>Unpair monitor</button></header>{error && <p className="display-error" role="alert">{error} <Link to="/display/pair">Pair this display</Link></p>}<section className="display-now" aria-labelledby="display-now-heading"><p className="eyebrow eyebrow-light">NOW CALLING</p><h2 id="display-now-heading">{current?.visitCode ?? "—"}</h2><p>{current ? snapshot.departmentName : "No visit is currently called."}</p></section><section className="display-waiting" aria-labelledby="display-waiting-heading"><div className="section-heading"><div><p className="eyebrow eyebrow-light">AUTHORIZED SNAPSHOT</p><h2 id="display-waiting-heading">Waiting</h2></div><span>{waiting.length} visits</span></div><ul>{waiting.map((visit) => <li key={visit.visitCode}><strong>{visit.visitCode}</strong></li>)}</ul>{snapshot && waiting.length === 0 && <p>No visits are waiting in this department.</p>}{!snapshot && !error && <p role="status">Loading assigned department snapshot…</p>}</section><footer className="board-footer"><span>Anonymous visit codes only</span><span>Snapshot refreshes after queue updates</span></footer></main>;
}
