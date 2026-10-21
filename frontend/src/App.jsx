import { useState } from "react";
import { Link, NavLink, Navigate, Outlet, Route, Routes } from "react-router";
import AdminLayout from "./features/admin/AdminLayout.jsx";
import AdminNavigation from "./features/admin/AdminNavigation.jsx";
import { adminSections } from "./features/admin/adminSections.js";
import DepartmentsSection from "./features/admin/sections/DepartmentsSection.jsx";
import ServicesSection from "./features/admin/sections/ServicesSection.jsx";
import UsersSection from "./features/admin/sections/UsersSection.jsx";
import StationsSection from "./features/admin/sections/StationsSection.jsx";
import DisplaysSection from "./features/admin/sections/DisplaysSection.jsx";
import DepartmentQueuePage from "./features/department/DepartmentQueuePage.jsx";
import ReceptionPage from "./features/reception/ReceptionPage.jsx";
import DisplayPairPage from "./features/display/DisplayPairPage.jsx";
import PairedDisplayPage from "./features/display/PairedDisplayPage.jsx";
import { AuthProvider } from "./auth/AuthProvider.jsx";
import ChangePasswordPage from "./auth/ChangePasswordPage.jsx";
import { useAuth } from "./auth/useAuth.js";
import SignInPage from "./auth/SignInPage.jsx";
import { homeForRole } from "./auth/roles.js";
import { RequireRole, RequireSession } from "./auth/RouteGuards.jsx";

const adminSectionRoutes = {
  departments: <DepartmentsSection />,
  services: <ServicesSection />,
  users: <UsersSection />,
  stations: <StationsSection />,
  displays: <DisplaysSection />,
};

function AppLayout() {
  const { user, logout, localSetupMode } = useAuth();
  const [signOutError, setSignOutError] = useState("");
  const isAdmin = user.role.toLowerCase() === "admin";
  const destinations = user.role.toLowerCase() === "reception"
    ? [{ to: "/reception", label: "Reception", note: "Issue and reprint visits" }]
    : [{ to: "/department", label: "Department queue", note: "Assigned work" }];

  async function signOut() {
    setSignOutError("");
    try { await logout(); } catch (error) { setSignOutError(error.message); }
  }

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="sidebar">
        <Link className="brand" to={homeForRole(user.role)} aria-label="Clinic queue home"><span className="brand-mark" aria-hidden="true">q</span><span><strong>Queue</strong><small>CLINIC WORKSPACE</small></span></Link>
        <p className="nav-caption">WORKSPACE</p>
        <nav className={`primary-nav${isAdmin ? " admin-primary-nav" : ""}`} aria-label="Workspace">
          {isAdmin ? <AdminNavigation /> : destinations.map(({ to, label, note }) => <NavLink className="nav-link" key={to} to={to}><span className="nav-link-copy"><span>{label}</span><small>{note}</small></span><span className="nav-indicator" aria-hidden="true" /></NavLink>)}
        </nav>
        <div className="sidebar-foot"><span className="status-dot" aria-hidden="true" /><span><strong>{user.userName}</strong><small>{user.role}</small></span></div>
      </aside>
      <div className="workspace">
        <header className="topbar"><div className="breadcrumb"><span>Clinic queue</span><span aria-hidden="true">/</span><strong>{user.role}</strong></div>{signOutError && <span role="alert">{signOutError}</span>}{localSetupMode ? <span className="surface-tag" role="status">Local setup mode · login disabled</span> : <button className="button button-quiet topbar-signout" type="button" onClick={signOut}>Sign out</button>}</header>
        <main id="main-content" className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}

function RoleHome() {
  const { authenticated, user, loading } = useAuth();
  if (loading) return <p className="auth-loading" role="status">Checking your session…</p>;
  return <Navigate to={authenticated ? user.mustChangePassword ? "/change-password" : homeForRole(user.role) : "/login"} replace />;
}

function WorkspaceRoutes() {
  return (
    <Routes>
        <Route path="/login" element={<SignInPage />} />
        <Route element={<RequireSession allowPasswordChange />}><Route path="/change-password" element={<ChangePasswordPage />} /></Route>
        <Route element={<RequireSession />}>
          <Route element={<AppLayout />}>
            <Route index element={<RoleHome />} />
            <Route element={<RequireRole roles={["admin"]} />}>
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="departments" replace />} />
                {adminSections.map(({ path }) => <Route key={path} path={path} element={adminSectionRoutes[path]} />)}
              </Route>
            </Route>
            <Route element={<RequireRole roles={["reception"]} />}><Route path="reception" element={<ReceptionPage />} /></Route>
            <Route element={<RequireRole roles={["staff"]} />}><Route path="department" element={<DepartmentQueuePage />} /></Route>
            <Route path="*" element={<RoleHome />} />
          </Route>
        </Route>
    </Routes>
  );
}

export default function App() {
  return <Routes>
    <Route path="/display/pair" element={<DisplayPairPage />} />
    <Route path="/display" element={<PairedDisplayPage />} />
    <Route path="*" element={<AuthProvider><WorkspaceRoutes /></AuthProvider>} />
  </Routes>;
}
