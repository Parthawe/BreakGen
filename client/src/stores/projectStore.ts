/**
 * Zustand store — canonical client-side state for the current project.
 *
 * This mirrors the server's KeyboardProject model and syncs on save.
 */

import { create } from "zustand";
import type { KeyboardProject, KeySpec, LayoutSpec } from "../types/project";
import { api } from "../lib/api";

interface ProjectStore {
  // State
  project: KeyboardProject | null;
  loading: boolean;
  dirty: boolean;
  selectedKeyIds: string[];

  // Actions
  loadProject: (id: string) => Promise<void>;
  createProject: (name: string, templateId?: string) => Promise<void>;
  save: () => Promise<void>;

  // Layout editing
  updateKey: (keyId: string, updates: Partial<KeySpec>) => void;
  addKey: (key: KeySpec) => void;
  removeKey: (keyId: string) => void;
  setLayout: (layout: LayoutSpec) => void;

  // Selection
  selectKey: (keyId: string, multi?: boolean) => void;
  clearSelection: () => void;

  // Switch
  setSwitch: (partId: string) => void;

  // Style
  setStylePrompt: (prompt: string) => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  loading: false,
  dirty: false,
  selectedKeyIds: [],

  loadProject: async (id) => {
    set({ loading: true });
    const project = await api.projects.get(id);
    set({ project, loading: false, dirty: false });
  },

  createProject: async (name, templateId) => {
    set({ loading: true });
    const project = await api.projects.create({
      name,
      template_id: templateId,
    });
    set({ project, loading: false, dirty: false });
  },

  save: async () => {
    const { project } = get();
    if (!project) return;

    const updated = await api.projects.update(project.project_id, {
      name: project.name,
      layout: project.layout,
      switch_part_id: project.switch_profile.part_id ?? undefined,
      style_prompt: project.style_request.prompt ?? undefined,
      expected_revision: project.revision,
    });
    // Consume the authoritative server response — revision, status, timestamps
    set({ project: updated, dirty: false });
  },

  updateKey: (keyId, updates) => {
    set((state) => {
      if (!state.project) return state;
      const keys = state.project.layout.keys.map((k) =>
        k.id === keyId ? { ...k, ...updates } : k
      );
      return {
        project: {
          ...state.project,
          layout: { ...state.project.layout, keys },
        },
        dirty: true,
      };
    });
  },

  addKey: (key) => {
    set((state) => {
      if (!state.project) return state;
      return {
        project: {
          ...state.project,
          layout: {
            ...state.project.layout,
            keys: [...state.project.layout.keys, key],
          },
        },
        dirty: true,
      };
    });
  },

  removeKey: (keyId) => {
    set((state) => {
      if (!state.project) return state;
      return {
        project: {
          ...state.project,
          layout: {
            ...state.project.layout,
            keys: state.project.layout.keys.filter((k) => k.id !== keyId),
          },
        },
        dirty: true,
        selectedKeyIds: state.selectedKeyIds.filter((id) => id !== keyId),
      };
    });
  },

  setLayout: (layout) => {
    set((state) => {
      if (!state.project) return state;
      return {
        project: { ...state.project, layout },
        dirty: true,
      };
    });
  },

  selectKey: (keyId, multi = false) => {
    set((state) => {
      if (multi) {
        const ids = state.selectedKeyIds.includes(keyId)
          ? state.selectedKeyIds.filter((id) => id !== keyId)
          : [...state.selectedKeyIds, keyId];
        return { selectedKeyIds: ids };
      }
      return { selectedKeyIds: [keyId] };
    });
  },

  clearSelection: () => set({ selectedKeyIds: [] }),

  setSwitch: (partId) => {
    set((state) => {
      if (!state.project) return state;
      return {
        project: {
          ...state.project,
          switch_profile: { ...state.project.switch_profile, part_id: partId },
        },
        dirty: true,
      };
    });
  },

  setStylePrompt: (prompt) => {
    set((state) => {
      if (!state.project) return state;
      return {
        project: {
          ...state.project,
          style_request: { ...state.project.style_request, prompt },
        },
        dirty: true,
      };
    });
  },
}));
