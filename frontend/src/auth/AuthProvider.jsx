import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { authApi, clearRequestToken } from "../api/client.js";
import { AuthContext } from "./AuthContext.js";

const localSetupEnabled = import.meta.env.DEV && import.meta.env.VITE_LOCAL_SETUP_MODE === true;
const localSetupUser = { userName: "Local setup", role: "Admin", departmentIds: [], serviceIds: [], mustChangePassword: false };
const localSetupExitKey = "queuing.local-setup-exited";

export function AuthProvider({ children }) {
  const { pathname } = useLocation();
  const [localSetupExited, setLocalSetupExited] = useState(() => sessionStorage.getItem(localSetupExitKey) === "true");
  const localSetupMode = localSetupEnabled && !localSetupExited && (pathname === "/" || pathname === "/admin" || pathname.startsWith("/admin/"));
  const [session, setSession] = useState({ loading: true, authenticated: false, user: null, error: "" });

  const refresh = useCallback(async (signal) => {
    if (localSetupMode) return localSetupUser;
    try {
      const result = await authApi.session(signal);
      const user = result.authenticated ? {
        userName: result.userName,
        role: result.role,
        departmentIds: result.departmentIds ?? [],
        serviceIds: result.serviceIds ?? [],
        mustChangePassword: Boolean(result.mustChangePassword),
      } : null;
      setSession({ loading: false, authenticated: Boolean(user), user, error: "" });
      return user;
    } catch (error) {
      if (error.name !== "AbortError") setSession({ loading: false, authenticated: false, user: null, error: error.message });
      return null;
    }
  }, [localSetupMode]);

  useEffect(() => {
    if (localSetupMode) return undefined;
    const controller = new AbortController();
    Promise.resolve().then(() => refresh(controller.signal));
    return () => controller.abort();
  }, [refresh, localSetupMode]);

  const login = useCallback(async (credentials) => {
    await authApi.login(credentials);
    return refresh();
  }, [refresh]);

  const changePassword = useCallback(async (credentials) => {
    await authApi.changePassword(credentials);
    return refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    if (localSetupMode) {
      const current = await authApi.session();
      if (current.authenticated) await authApi.logout();
      sessionStorage.setItem(localSetupExitKey, "true");
      setLocalSetupExited(true);
    } else {
      await authApi.logout();
    }
    clearRequestToken();
    setSession({ loading: false, authenticated: false, user: null, error: "" });
  }, [localSetupMode]);

  const value = useMemo(() => ({
    ...session,
    loading: localSetupMode ? false : session.loading,
    authenticated: localSetupMode || session.authenticated,
    user: localSetupMode ? localSetupUser : session.user,
    localSetupMode,
    login,
    logout,
    changePassword,
    refresh,
  }), [session, localSetupMode, login, logout, changePassword, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
