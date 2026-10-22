import { useState } from "react";
import { Outlet } from "react-router";

export default function AdminLayout() {
  const [credential, setCredential] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [kioskPairingCode, setKioskPairingCode] = useState("");

  return (
    <section aria-labelledby="admin-heading">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1 id="admin-heading">Clinic configuration</h1>
          <p>Manage departments, services, stations, staff access, displays, and kiosks.</p>
        </div>
        <span className="surface-tag">API managed</span>
      </div>
      {credential && <p className="action-message" role="status"><strong>One-time credential:</strong> <code>{credential}</code> Save it now; it is shown only once.</p>}
      {pairingCode && <p className="action-message" role="status"><strong>One-time monitor pairing code:</strong> <code>{pairingCode}</code> Enter this on the monitor pairing page. <a className="text-button" href="/display/pair" target="_blank" rel="noopener noreferrer">Open pairing page in a new tab</a></p>}
      {kioskPairingCode && <p className="action-message" role="status"><strong>One-time kiosk pairing code:</strong> <code>{kioskPairingCode}</code> Enter it on the kiosk device within 10 minutes. <a className="text-button" href="/kiosk/pair" target="_blank" rel="noopener noreferrer">Open kiosk pairing page</a></p>}
      <Outlet context={{ setCredential, setPairingCode, setKioskPairingCode }} />
    </section>
  );
}
