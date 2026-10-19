import { Link, NavLink, Navigate, Outlet, Route, Routes } from "react-router";
import AdminPage from "./features/admin/AdminPage.jsx";
import DisplayPage from "./features/display/DisplayPage.jsx";
import StaffPage from "./features/staff/StaffPage.jsx";
import TicketsPage from "./features/tickets/TicketsPage.jsx";

const destinations = [
  { to: "/staff", label: "Staff desk", note: "Queue operations" },
  { to: "/tickets", label: "Issue ticket", note: "Reception" },
  { to: "/admin", label: "Admin setup", note: "Services and counters" },
  { to: "/display", label: "Public display", note: "Waiting room" },
];

function AppLayout() {
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="sidebar">
        <Link className="brand" to="/staff" aria-label="Clinic queue home">
          <span className="brand-mark" aria-hidden="true">q</span>
          <span><strong>Queue</strong><small>CLINIC WORKSPACE</small></span>
        </Link>
        <p className="nav-caption">WORKSPACE</p>
        <nav className="primary-nav" aria-label="Workspace">
          {destinations.map(({ to, label, note }) => (
            <NavLink className="nav-link" key={to} to={to}>
              <span className="nav-link-copy"><span>{label}</span><small>{note}</small></span>
              <span className="nav-indicator" aria-hidden="true" />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="status-dot" aria-hidden="true" />
          <span><strong>Preview mode</strong><small>No live queue connection</small></span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>Sample clinic</span><span aria-hidden="true">/</span><strong>Queue operations</strong></div>
          <span className="demo-badge">DEMO DATA</span>
        </header>
        <main id="main-content" className="page-content">
          <aside className="demo-notice" aria-label="Demo notice">
            <span className="notice-mark" aria-hidden="true">i</span>
            <p><strong>Preview workspace.</strong> Sample data only; actions are not saved or sent to a server.</p>
          </aside>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/staff" replace />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="display" element={<DisplayPage />} />
        <Route path="*" element={<Navigate to="/staff" replace />} />
      </Route>
    </Routes>
  );
}
