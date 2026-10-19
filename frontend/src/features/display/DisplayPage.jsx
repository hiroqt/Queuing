import { demoSnapshot } from "../../data/demo-snapshot.js";

export default function DisplayPage() {
  const activeCall = demoSnapshot.called[0];

  return (
    <section aria-labelledby="display-heading">
      <div className="page-heading">
        <div><p className="eyebrow">PUBLIC VIEW</p><h1 id="display-heading">Waiting room display</h1><p>A read-only layout for anonymous queue information.</p></div>
        <span className="surface-tag">Sample snapshot · not live</span>
      </div>
      <div className="public-board" aria-label="Sample public queue board">
        <header className="board-header"><div><p className="eyebrow eyebrow-light">SAMPLE CLINIC</p><h2>Now calling</h2></div><span className="board-status"><span className="status-dot" aria-hidden="true" />Sample data</span></header>
        <section className="board-current" aria-label="Current sample call"><div><p className="eyebrow eyebrow-light">PLEASE GO TO {activeCall.counter.toUpperCase()}</p><strong>{activeCall.number}</strong></div><div className="board-service"><span>Service</span><strong>{activeCall.service}</strong></div></section>
        <section className="board-waiting" aria-labelledby="board-waiting-heading">
          <div className="section-heading"><div><p className="eyebrow">QUEUE PREVIEW</p><h2 id="board-waiting-heading">Waiting</h2></div><span className="count-label">{demoSnapshot.waiting.length} samples</span></div>
          <ul>{demoSnapshot.waiting.slice(0, 3).map((ticket) => <li key={ticket.id}><strong>{ticket.number}</strong><span>{ticket.service}</span><span>Waiting</span></li>)}</ul>
        </section>
        <footer className="board-footer"><span>Only sample ticket, service, and counter details are shown.</span><span>Not connected to a live queue</span></footer>
      </div>
    </section>
  );
}
