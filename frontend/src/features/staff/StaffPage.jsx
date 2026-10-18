import { useState } from "react";
import { demoSnapshot } from "../../data/demo-snapshot.js";
import { selectWaitingTickets } from "./queue-view-model.js";

export default function StaffPage() {
  const [message, setMessage] = useState("");
  const waiting = selectWaitingTickets(demoSnapshot.waiting);
  const longestWait = waiting.length ? Math.max(...waiting.map((ticket) => ticket.waitMinutes)) : null;

  function explainPreviewAction() {
    setMessage("No queue command was sent. Connect the queue API before changing ticket status.");
  }

  return (
    <section aria-labelledby="staff-heading">
      <div className="page-heading">
        <div><p className="eyebrow">STAFF WORKSPACE</p><h1 id="staff-heading">Staff desk</h1><p>Review the queue snapshot and the actions available to an assigned counter.</p></div>
        <span className="surface-tag">Sample counter · not assigned</span>
      </div>

      <div className="staff-layout">
        <div className="staff-main">
          <section className="current-call" aria-labelledby="current-call-heading">
            <div className="current-call-copy">
              <p className="eyebrow eyebrow-light">CURRENT CALL · SAMPLE</p>
              <h2 id="current-call-heading">{demoSnapshot.called[0].number}</h2>
              <p>{demoSnapshot.called[0].service}<span className="call-divider">·</span>{demoSnapshot.called[0].counter}</p>
            </div>
            <div className="call-actions">
              <button className="button button-primary" onClick={explainPreviewAction}>Call next</button>
              <button className="button button-quiet" onClick={explainPreviewAction}>Complete</button>
              <button className="button button-quiet" onClick={explainPreviewAction}>Skip</button>
            </div>
          </section>

          {message && <p className="action-message" role="status">{message}</p>}

          <section className="queue-section" aria-labelledby="waiting-heading">
            <div className="section-heading">
              <div><p className="eyebrow">QUEUE SNAPSHOT</p><h2 id="waiting-heading">Waiting tickets</h2></div>
              <span className="count-label"><strong>{waiting.length.toString().padStart(2, "0")}</strong> waiting</span>
            </div>
            <div className="queue-table-wrap">
              <table className="queue-table">
                <caption className="visually-hidden">Synthetic waiting ticket queue</caption>
                <thead><tr><th scope="col">Ticket</th><th scope="col">Service</th><th scope="col">Wait</th><th scope="col">Status</th></tr></thead>
                <tbody>{waiting.length === 0 ? (
                  <tr key="empty"><td className="empty-queue" colSpan="4">No sample tickets waiting.</td></tr>
                ) : waiting.map((ticket) => (
                  <tr key={ticket.id}>
                    <th scope="row"><span className="ticket-number">{ticket.number}</span></th>
                    <td>{ticket.service}</td>
                    <td>{ticket.waitMinutes} min</td>
                    <td><span className="status-label"><span className="status-dot status-dot-waiting" aria-hidden="true" />Waiting</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <p className="table-note">Order is shown as provided by this sample snapshot.</p>
          </section>
        </div>

        <aside className="staff-aside" aria-label="Queue details">
          <section className="detail-panel">
            <p className="eyebrow">TODAY'S SNAPSHOT</p>
            <div className="summary-line"><span>Waiting</span><strong>{waiting.length}</strong></div>
            <div className="summary-line"><span>Currently called</span><strong>{demoSnapshot.called.length}</strong></div>
            <div className="summary-line"><span>Longest sample wait</span><strong>{longestWait === null ? "—" : `${longestWait} min`}</strong></div>
          </section>
          <section className="detail-panel next-ticket-panel">
            <p className="eyebrow">NEXT IN SNAPSHOT</p>
            <strong className="next-ticket-number">{waiting[0]?.number ?? "—"}</strong>
            <span>{waiting[0]?.service ?? "No waiting sample"}</span>
            <button className="text-button" onClick={explainPreviewAction}>Review call action <span aria-hidden="true">→</span></button>
          </section>
        </aside>
      </div>
    </section>
  );
}
