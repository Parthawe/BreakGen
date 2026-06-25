import { create } from "zustand";
import { api, isApiError } from "../lib/api";

interface User {
  id: number;
  email: string;
  name: string;
}

type SessionState =
  | "unknown"
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "expired"
  | "offline";

interface AuthStore {
  user: User | null;
  token: string | null;
  initialized: boolean;
  sessionState: SessionState;
  sessionNotice: string | null;
  loading: boolean;
  error: string | null;

  signup: (email: string, name: string, password: string, inviteCode?: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loadSession: () => Promise<void>;
  clearError: () => void;
  clearSessionNotice: () => void;
  handleUnauthorized: (message?: string) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: localStorage.getItem("breakgen_token"),
  initialized: false,
  sessionState: localStorage.getItem("breakgen_token") ? "unknown" : "unauthenticated",
  sessionNotice: null,
  loading: false,
  error: null,

  signup: async (email, name, password, inviteCode) => {
    set({ loading: true, error: null, sessionNotice: null });
    try {
      const trimmedInviteCode = inviteCode?.trim();
      const data = await api.auth.signup({
        email,
        name,
        password,
        ...(trimmedInviteCode ? { invite_code: trimmedInviteCode } : {}),
      });
      localStorage.setItem("breakgen_token", data.token);
      set({
        user: data.user,
        token: data.token,
        initialized: true,
        sessionState: "authenticated",
        sessionNotice: null,
        loading: false,
      });
      return true;
    } catch (error) {
      set({
        loading: false,
        initialized: true,
        error: isApiError(error) ? error.detail : "Account creation failed",
      });
      return false;
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null, sessionNotice: null });
    try {
      const data = await api.auth.login({ email, password });
      localStorage.setItem("breakgen_token", data.token);
      set({
        user: data.user,
        token: data.token,
        initialized: true,
        sessionState: "authenticated",
        sessionNotice: null,
        loading: false,
      });
      return true;
    } catch (error) {
      set({
        loading: false,
        initialized: true,
        error: isApiError(error) ? error.detail : "Login failed",
      });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem("breakgen_token");
    set({
      user: null,
      token: null,
      initialized: true,
      sessionState: "unauthenticated",
      sessionNotice: null,
      error: null,
    });
  },

  loadSession: async () => {
    const token = get().token;
    if (!token) {
      set({
        initialized: true,
        sessionState: "unauthenticated",
        sessionNotice: null,
      });
      return;
    }
    set({ sessionState: "loading" });
    try {
      const user = await api.auth.me();
      set({
        user,
        initialized: true,
        sessionState: "authenticated",
        sessionNotice: null,
      });
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        localStorage.removeItem("breakgen_token");
        set({
          user: null,
          token: null,
          initialized: true,
          sessionState: "expired",
          sessionNotice: "Your authenticated alpha session expired. Sign in again to continue editing.",
        });
        return;
      }

      set({
        initialized: true,
        sessionState: "offline",
        sessionNotice:
          "BreakGen cannot reach the backend right now. Saved projects and compile actions are unavailable until the API is back.",
      });
    }
  },

  clearError: () => set({ error: null }),
  clearSessionNotice: () => set({ sessionNotice: null }),
  handleUnauthorized: (message) => {
    localStorage.removeItem("breakgen_token");
    set({
      user: null,
      token: null,
      initialized: true,
      sessionState: "expired",
      sessionNotice:
        message ??
        "Your authenticated alpha session expired. Sign in again to continue editing.",
      error: null,
    });
  },
}));
