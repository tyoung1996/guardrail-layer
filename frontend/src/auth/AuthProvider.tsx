import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: any | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("jwt") || null
  );
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!token;

  // Load user from /auth/me
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 401) return null;
        try {
          return await res.json();
        } catch {
          return null;
        }
      })
      .then((data) => {
        if (!data) return logout();
        console.log(data);
        setUser(data);
        // Redirect based on role
        if (data?.roles?.some((r: any) => r.role?.name?.toLowerCase() === "admin")) {
          navigate("/");
        } else {
          navigate("/chat");
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function login(email: string, password: string) {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) return false;
    const data = await res.json();
console.log(data)
    localStorage.setItem("jwt", data.token);
    setToken(data.token);

    return true;
  }

  function logout() {
    localStorage.removeItem("jwt");
    setToken(null);
    setUser(null);
    navigate("/login");
  }

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center text-gray-300">
        Loading…
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}