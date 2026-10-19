import { useState } from "react";
import { demoSnapshot } from "../../data/demo-snapshot.js";

export default function TicketsPage() {
  const [service, setService] = useState(demoSnapshot.services[0]);
  const [message, setMessage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  function showPreview(event) {
    event.preventDefault();
    setPreviewOpen(true);
    setMessage("Preview ready. No ticket was issued; the server assigns the canonical number.");
  }

  return (
    <section aria-labelledby="ticket-heading">
      <div className="page-heading">
        <div><p className="eyebrow">RECEPTION</p><h1 id="ticket-heading">Issue a ticket</h1><p>Review the service selection and sample print layout.</p></div>
        <span className="surface-tag">No ticket will be created</span>
      </div>
      <div className="ticket-layout">
        <section className="content-panel issue-panel" aria-labelledby="service-selection-heading">
          <p className="eyebrow">NEW VISIT</p><h2 id="service-selection-heading">Choose a service</h2>
          <p className="panel-description">The queue server must confirm availability and assign each ticket number.</p>
          <form onSubmit={showPreview}>
            <label htmlFor="ticket-service">Service</label>
            <select id="ticket-service" value={service} onChange={(event) => setService(event.target.value)}>
              {demoSnapshot.services.map((item) => <option key={item}>{item}</option>)}
            </select>
            <button className="button button-dark" type="submit">Preview ticket</button>
          </form>
          {message && <p className="action-message" role="status">{message}</p>}
        </section>
        <section className="ticket-preview-area" aria-labelledby="ticket-preview-heading">
          <div className="section-heading"><div><p className="eyebrow">58 / 80 MM PREVIEW</p><h2 id="ticket-preview-heading">Ticket layout</h2></div><span className="count-label">Sample</span></div>
          <article className="paper-ticket" aria-label="Sample ticket preview">
            <span className="sample-stamp">SAMPLE · NOT VALID</span>
            <p className="ticket-clinic">SAMPLE CLINIC</p>
            <p className="paper-service">{previewOpen ? service : "Service name"}</p>
            <p className="paper-number">— — —</p>
            <p className="paper-assignment">Ticket number assigned after server confirmation</p>
            <div className="paper-rule" />
            <p className="paper-footer">Please wait for your number to be called.</p>
          </article>
          <p className="table-note">This preview cannot issue or print a valid queue ticket.</p>
        </section>
      </div>
    </section>
  );
}
