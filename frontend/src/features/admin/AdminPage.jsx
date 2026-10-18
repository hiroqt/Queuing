import { useState } from "react";
import { demoSnapshot } from "../../data/demo-snapshot.js";

export default function AdminPage() {
  const [message, setMessage] = useState("");

  function explainPreviewAction(event) {
    event.preventDefault();
    setMessage("Preview only. No configuration was saved or sent to a server.");
  }

  return (
    <section aria-labelledby="admin-heading">
      <div className="page-heading">
        <div><p className="eyebrow">CONFIGURATION PREVIEW</p><h1 id="admin-heading">Admin setup</h1><p>Review the kinds of settings an administrator can manage.</p></div>
        <span className="surface-tag">Illustrative settings</span>
      </div>
      <div className="admin-layout">
        <section className="content-panel" aria-labelledby="services-heading">
          <div className="section-heading"><div><p className="eyebrow">QUEUE CATALOG</p><h2 id="services-heading">Services</h2></div><span className="count-label">{demoSnapshot.services.length} samples</span></div>
          <ul className="settings-list">{demoSnapshot.services.map((service, index) => <li key={service}><span className="list-index">0{index + 1}</span><span>{service}</span><span className="enabled-label">Sample</span></li>)}</ul>
        </section>
        <section className="content-panel" aria-labelledby="counters-heading">
          <div className="section-heading"><div><p className="eyebrow">STAFF WORK AREAS</p><h2 id="counters-heading">Counters</h2></div><span className="count-label">{demoSnapshot.counters.length} samples</span></div>
          <ul className="settings-list">{demoSnapshot.counters.map((counter, index) => <li key={counter}><span className="list-index">0{index + 1}</span><span>{counter}</span><span className="enabled-label">Sample</span></li>)}</ul>
        </section>
        <section className="content-panel admin-form-panel" aria-labelledby="preview-config-heading">
          <div><p className="eyebrow">FORM PREVIEW</p><h2 id="preview-config-heading">Add a service</h2><p className="panel-description">A future form can configure a service after an approved API is available.</p></div>
          <form onSubmit={explainPreviewAction}>
            <label htmlFor="service-name">Service name</label>
            <input id="service-name" name="serviceName" placeholder="For example, consultation" />
            <button className="button button-dark" type="submit">Preview save</button>
          </form>
          {message && <p className="action-message" role="status">{message}</p>}
        </section>
        <section className="content-panel" aria-labelledby="display-profiles-heading">
          <div className="section-heading"><div><p className="eyebrow">PUBLIC SCREENS</p><h2 id="display-profiles-heading">Display profiles</h2></div><span className="count-label">{demoSnapshot.displays.length} samples</span></div>
          <ul className="settings-list">{demoSnapshot.displays.map((display, index) => <li key={display}><span className="list-index">0{index + 1}</span><span>{display}</span><span className="enabled-label">Preview</span></li>)}</ul>
        </section>
      </div>
    </section>
  );
}
