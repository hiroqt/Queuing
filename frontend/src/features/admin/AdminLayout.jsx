import { useState } from "react";
import { Outlet, useLocation } from "react-router";
import AdminOneTimeDialog from "./components/AdminOneTimeDialog.jsx";

export default function AdminLayout() {
  const [oneTimeNotice, setOneTimeNotice] = useState(null);
  const { pathname } = useLocation();
  const isDashboard = pathname === "/admin" || pathname.startsWith("/admin/dashboard");

  return (
    <section aria-labelledby="admin-heading">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1 id="admin-heading">{isDashboard ? "Dashboard" : "Clinic configuration"}</h1>
          <p>{isDashboard ? "See your clinic setup and current department queues at a glance." : "Manage departments, services, stations, staff access, displays, and kiosks."}</p>
        </div>
        <span className="surface-tag">API managed</span>
      </div>
      <Outlet context={{ setOneTimeNotice }} />
      {oneTimeNotice && <AdminOneTimeDialog key={`${oneTimeNotice.kind}-${oneTimeNotice.userName ?? oneTimeNotice.itemName}`} notice={oneTimeNotice} onClose={() => setOneTimeNotice(null)} />}
    </section>
  );
}
