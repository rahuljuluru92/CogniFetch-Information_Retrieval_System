import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, onUnauthorized } from "../lib/api";
import { clearStudy } from "../lib/study";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | authenticated | anonymous

  const setSession = useCallback((nextUser) => {
    setUser(nextUser);
    setStatus(nextUser ? "authenticated" : "anonymous");
  }, []);

  useEffect(() => {
    let active = true;
    api
      .me()
      .then(({ user: me }) => active && setSession(me))
      .catch(() => active && setSession(null));
    onUnauthorized(() => setSession(null));
    return () => {
      active = false;
      onUnauthorized(null);
    };
  }, [setSession]);

  const login = useCallback(async (credentials) => setSession((await api.login(credentials)).user), [setSession]);
  const register = useCallback(async (details) => setSession((await api.register(details)).user), [setSession]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      clearStudy();
      setSession(null);
    }
  }, [setSession]);

  const deleteAccount = useCallback(
    async (password) => {
      await api.deleteAccount(password);
      clearStudy();
      setSession(null);
    },
    [setSession],
  );

  const value = useMemo(
    () => ({ user, status, login, register, logout, deleteAccount }),
    [user, status, login, register, logout, deleteAccount],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
