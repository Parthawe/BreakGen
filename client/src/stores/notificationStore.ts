import { create } from "zustand";

export type NotificationTone = "info" | "success" | "warning" | "error";

export interface NotificationItem {
  id: string;
  tone: NotificationTone;
  title: string;
  message?: string;
  createdAt: number;
}

interface NotificationStore {
  items: NotificationItem[];
  notify: (item: Omit<NotificationItem, "id" | "createdAt">) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

function createNotificationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `notice_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  items: [],

  notify: (item) => {
    const id = createNotificationId();
    set((state) => ({
      items: [
        {
          ...item,
          id,
          createdAt: Date.now(),
        },
        ...state.items,
      ].slice(0, 4),
    }));
    return id;
  },

  dismiss: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),

  clear: () => set({ items: [] }),
}));

