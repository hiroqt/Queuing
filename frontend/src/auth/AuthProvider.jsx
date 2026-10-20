import { useCallback, useEffect, useMemo, useState } from "react";
import { authApi, clearRequestToken } from "../api/client.js";
import { AuthContext } from "./AuthContext.js";

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ loading: true, authenticated: false, user: null, error: "" });

  const refresh = useCallback(async (signal) => {
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

  const value = useMemo(() => ({ ...session, login, logout, changePassword, refresh }), [session, login, logout, changePassword, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
