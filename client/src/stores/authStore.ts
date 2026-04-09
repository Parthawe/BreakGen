import { create } from "zustand";

interface User {
  id: number;
  email: string;
  name: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;

  signup: (email: string, name: string, password: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loadSession: () => Promise<void>;
  clearError: () => void;
}

const BASE = "/api/auth";

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: localStorage.getItem("breakgen_token"),
  loading: false,
  error: null,

  signup: async (email, name, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ loading: false, error: data.detail || "Signup failed" });
        return false;
      }
      const data = await res.json();
      localStorage.setItem("breakgen_token", data.token);
      set({ user: data.user, token: data.token, loading: false });
      return true;
    } catch {
      set({ loading: false, error: "Network error" });
      return false;
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        set({ loading: false, error: data.detail || "Login failed" });
        return false;
      }
      const data = await res.json();
      localStorage.setItem("breakgen_token", data.token);
      set({ user: data.user, token: data.token, loading: false });
      return true;
    } catch {
      set({ loading: false, error: "Network error" });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem("breakgen_token");
    set({ user: null, token: null });
  },

  loadSession: async () => {
    const token = get().token;
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user = await res.json();
        set({ user });
      } else {
        localStorage.removeItem("breakgen_token");
        set({ token: null });
      }
    } catch {
      // Silently fail — server might be down
    }
  },

  clearError: () => set({ error: null }),
}));
