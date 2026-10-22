import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { authApi, clearRequestToken } from "../api/client.js";
import { AuthContext } from "./AuthContext.js";

const localSetupMode = import.meta.env.DEV && import.meta.env.VITE_LOCAL_SETUP_MODE === true;
const localSetupUser = { userName: "Local setup", role: "Admin", departmentIds: [], mustChangePassword: false };

export function AuthProvider({ children }) {
  const { pathname } = useLocation();
  const [session, setSession] = useState(() => localSetupMode
    ? { loading: false, authenticated: true, user: localSetupUser, error: "" }
    : { loading: true, authenticated: false, user: null, error: "" });
  const localSetupPath = pathname.replace(/\/+$/, "");
  const localSetupRole = localSetupPath === "/reception" ? "Reception" : localSetupPath === "/department" ? "Staff" : "Admin";

  const refresh = useCallback(async (signal) => {
    if (localSetupMode) return localSetupUser;
    try {
      const result = await authApi.session(signal);
      const user = result.authenticated ? {
        userName: result.userName,
        role: result.role,
        departmentIds: result.departmentIds ?? [],
        mustChangePassword: Boolean(result.mustChangePassword),
      } : null;
      setSession({ loading: false, authenticated: Boolean(user), user, error: "" });
      return user;
    } catch (error) {
      if (error.name !== "AbortError") setSession({ loading: false, authenticated: false, user: null, error: error.message });
      return null;
    }
  }, []);

  useEffect(() => {
    if (localSetupMode) return undefined;
    const controller = new AbortController();
    Promise.resolve().then(() => refresh(controller.signal));
    return () => controller.abort();
  }, [refresh]);

  const login = useCallback(async (credentials) => {
    await authApi.login(credentials);
    return refresh();
  }, [refresh]);

  const changePassword = useCallback(async (credentials) => {
    await authApi.changePassword(credentials);
    return refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await authApi.logout();
    clearRequestToken();
    setSession({ loading: false, authenticated: false, user: null, error: "" });
  }, []);

  const value = useMemo(() => ({
    ...session,
    user: localSetupMode ? { ...localSetupUser, role: localSetupRole } : session.user,
    localSetupMode,
    login,
    logout,
    changePassword,
    refresh,
  }), [session, localSetupRole, login, logout, changePassword, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
