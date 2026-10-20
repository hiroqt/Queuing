import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "./useAuth.js";
import { canAccessRole, homeForRole } from "./roles.js";

export function RequireSession({ allowPasswordChange = false }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) return <p className="auth-loading" role="status">Checking your session…</p>;
  if (!auth.authenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (auth.user.mustChangePassword && !allowPasswordChange) return <Navigate to="/change-password" replace />;
  if (allowPasswordChange && !auth.user.mustChangePassword) return <Navigate to={homeForRole(auth.user.role)} replace />;
  return <Outlet />;
}

export function RequireRole({ roles }) {
  const { user } = useAuth();
  if (!canAccessRole(user?.role, roles)) return <Navigate to={homeForRole(user?.role)} replace />;
  return <Outlet />;
}
