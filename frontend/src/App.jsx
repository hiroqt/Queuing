import { Link, NavLink, Navigate, Outlet, Route, Routes } from "react-router";
import AdminPage from "./features/admin/AdminPage.jsx";
import QueueDashboard from "./features/queue/QueueDashboard.jsx";

const destinations = [
  { to: "/dashboard", label: "Queue dashboard", note: "Issue and display" },
  { to: "/admin", label: "Admin setup", note: "Services and counters" },
];

function AppLayout() {
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="sidebar">
        <Link className="brand" to="/dashboard">
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
          <span><strong>Local API demo</strong><small>Volatile queue state</small></span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>Clinic queue</span><span aria-hidden="true">/</span><strong>Presentation</strong></div>
          <span className="demo-badge">LOCAL DEMO</span>
        </header>
        <main id="main-content" className="page-content">
          <aside className="demo-notice" aria-label="Demo notice">
            <span className="notice-mark" aria-hidden="true">i</span>
            <p><strong>Presentation demo.</strong> Tickets live in API memory and clear when it restarts. Do not enter patient information.</p>
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
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<QueueDashboard />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="staff" element={<Navigate to="/dashboard" replace />} />
        <Route path="tickets" element={<Navigate to="/dashboard" replace />} />
        <Route path="display" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
