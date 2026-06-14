import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api, User, setToken, removeToken } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("lpr_token");
    if (token) {
      api.me()
        .then(setUser)
        .catch(() => { removeToken(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const { access_token } = await api.login(username, password);
    setToken(access_token);
    const me = await api.me();
    if (me.status === "inactivo") {
      removeToken();
      throw new Error("Tu cuenta está inactiva. Contacta al administrador.");
    }
    setUser(me);
  };

  const logout = () => {
    api.logout();
    removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user?.role === "administrador" }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
