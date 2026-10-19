import { useEffect, useRef, useState } from "react";
import { getDisplaySnapshot, getServices, issueTicket } from "./api.js";

function TicketReceipt({ ticket }) {
  if (!ticket) return null;

  return (
    <article className="dashboard-receipt ticket-receipt" aria-labelledby="receipt-heading">
      <div className="receipt-heading">
        <div><p className="eyebrow">ISSUED TICKET</p><h2 id="receipt-heading">Your ticket</h2></div>
        <button className="button button-dark no-print" type="button" onClick={() => window.print()}>Print ticket</button>
      </div>
      <p className="receipt-clinic">CLINIC QUEUE PRESENTATION</p>
      <p className="receipt-number">{ticket.number}</p>
      <p className="receipt-service">{ticket.serviceName}</p>
      <p className="receipt-time">Issued {new Date(ticket.issuedAtUtc).toLocaleTimeString()}</p>
      <p className="receipt-note">Please watch the waiting room display for your turn.</p>
    </article>
  );
}

export default function QueueDashboard() {
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [displayError, setDisplayError] = useState("");
  const [issueError, setIssueError] = useState("");
  const [message, setMessage] = useState("");
  const issueKey = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getServices(controller.signal), getDisplaySnapshot(controller.signal)])
      .then(([availableServices, display]) => {
        setServices(availableServices);
        setServiceId(availableServices[0]?.id ?? "");
        setSnapshot(display);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setLoadError(error.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  async function submitTicket(event) {
    event.preventDefault();
    setPending(true);
    setIssueError("");
    setMessage("");
    issueKey.current ??= crypto.randomUUID();

    try {
      const issued = await issueTicket(serviceId, issueKey.current);
      setTicket(issued);
      issueKey.current = null;
      setMessage(`Ticket ${issued.number} issued.`);
      try {
        setSnapshot(await getDisplaySnapshot());
        setDisplayError("");
      } catch (error) {
        setDisplayError(`Ticket issued, but the display could not refresh: ${error.message}`);
      }
    } catch (error) {
      setIssueError(error.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="dashboard-heading">
      <div className="page-heading dashboard-heading">
        <div><p className="eyebrow">LOCAL PRESENTATION</p><h1 id="dashboard-heading">Queue dashboard</h1><p>Issue a ticket and see the waiting room display update from the queue API.</p></div>
        <span className="surface-tag">Single-process demo</span>
      </div>

      {loadError && <p className="action-message" role="alert">Queue API unavailable: {loadError}</p>}

      <div className="dashboard-layout">
        <section className="content-panel dashboard-issue" aria-labelledby="issue-heading">
          <p className="eyebrow">RECEPTION</p><h2 id="issue-heading">Issue a ticket</h2>
          <p className="panel-description">Choose a service. The API assigns the next ticket number.</p>
          <form onSubmit={submitTicket}>
            <label htmlFor="dashboard-service">Service</label>
            <select id="dashboard-service" value={serviceId} onChange={(event) => { setServiceId(event.target.value); issueKey.current = null; }} disabled={loading || pending || services.length === 0}>
              {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </select>
            <button className="button button-dark" type="submit" disabled={loading || pending || !serviceId}>
              {pending ? "Issuing…" : "Issue ticket"}
            </button>
          </form>
          {loading && <p className="panel-description" role="status">Connecting to the local queue…</p>}
          {issueError && <p className="action-message" role="alert">{issueError}</p>}
          {message && <p className="action-message" role="status">{message}</p>}
          {displayError && <p className="action-message" role="alert">{displayError}</p>}
          <TicketReceipt ticket={ticket} />
        </section>

        <section className="public-board dashboard-board" aria-labelledby="display-heading">
          <header className="board-header"><div><p className="eyebrow eyebrow-light">PUBLIC VIEW</p><h2 id="display-heading">Waiting room display</h2></div><span className="board-status"><span className="status-dot" aria-hidden="true" />Local queue</span></header>
          <section className="board-waiting" aria-labelledby="waiting-heading">
            <div className="section-heading"><div><p className="eyebrow eyebrow-light">NEXT IN QUEUE</p><h3 id="waiting-heading">Waiting tickets</h3></div><span className="count-label">{snapshot?.totalWaiting ?? 0} waiting</span></div>
            <ul>
              {!snapshot && <li className="board-empty">Queue display is loading.</li>}
              {snapshot?.waiting.length === 0 && <li className="board-empty">No tickets are waiting.</li>}
              {snapshot?.waiting.map((waitingTicket) => <li key={waitingTicket.number}><strong>{waitingTicket.number}</strong><span>{waitingTicket.serviceName}</span><span>{waitingTicket.status}</span></li>)}
            </ul>
            {snapshot && snapshot.totalWaiting > snapshot.waiting.length && <p className="board-note">Showing the next {snapshot.waiting.length} tickets.</p>}
          </section>
          <section className="board-waiting board-calling" aria-labelledby="calling-heading">
            <div className="section-heading"><div><p className="eyebrow eyebrow-light">NOW CALLING</p><h3 id="calling-heading">Calling tickets</h3></div></div>
            <ul>
              {!snapshot && <li className="board-empty">Queue display is loading.</li>}
              {snapshot?.calling.length === 0 && <li className="board-empty">No tickets are being called.</li>}
              {snapshot?.calling.map((calledTicket) => <li key={calledTicket.number}><strong>{calledTicket.number}</strong><span>{calledTicket.serviceName}</span><span>{calledTicket.status}</span></li>)}
            </ul>
          </section>
          <footer className="board-footer"><span>Ticket number, service, and status only.</span><span>Queue clears when the API restarts.</span></footer>
        </section>
      </div>
    </section>
  );
}
