/**
 * Zustand store — canonical client-side state for the current project.
 *
 * This mirrors the server's KeyboardProject model and syncs on save.
 */

import { create } from "zustand";
import type { KeyboardProject, KeySpec, LayoutSpec, UpdateProjectRequest } from "../types/project";
import { api } from "../lib/api";

type DirtyField = "name" | "layout" | "switch" | "style";

const MAX_UNDO = 50;

interface ProjectStore {
  // State
  project: KeyboardProject | null;
  loading: boolean;
  dirty: boolean;
  dirtyFields: Set<DirtyField>;
  selectedKeyIds: string[];
  error: string | null;
  undoStack: KeySpec[][];
  redoStack: KeySpec[][];

  // Actions
  loadProject: (id: string) => Promise<void>;
  createProject: (name: string, templateId?: string) => Promise<void>;
  save: () => Promise<void>;
  clearError: () => void;
  undo: () => void;
  redo: () => void;

  // Layout editing
  pushUndo: () => void;
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

function markDirty(state: { dirtyFields: Set<DirtyField> }, field: DirtyField) {
  const next = new Set(state.dirtyFields);
  next.add(field);
  return { dirty: true, dirtyFields: next };
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  loading: false,
  dirty: false,
  dirtyFields: new Set(),
  selectedKeyIds: [],
  error: null,
  undoStack: [],
  redoStack: [],

  loadProject: async (id) => {
    set({ loading: true, error: null });
    try {
      const project = await api.projects.get(id);
      set({ project, loading: false, dirty: false, dirtyFields: new Set() });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Failed to load project" });
    }
  },

  createProject: async (name, templateId) => {
    set({ loading: true, error: null });
    try {
      const project = await api.projects.create({
        name,
        template_id: templateId,
      });
      set({ project, loading: false, dirty: false, dirtyFields: new Set() });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Failed to create project" });
    }
  },

  save: async () => {
    const { project, dirtyFields } = get();
    if (!project || dirtyFields.size === 0) return;

    set({ error: null });
    try {
      const req: UpdateProjectRequest = {
        expected_revision: project.revision,
      };
      if (dirtyFields.has("name")) req.name = project.name;
      if (dirtyFields.has("layout")) req.layout = project.layout;
      if (dirtyFields.has("switch"))
        req.switch_part_id = project.switch_profile.part_id ?? undefined;
      if (dirtyFields.has("style"))
        req.style_prompt = project.style_request.prompt ?? undefined;

      const updated = await api.projects.update(project.project_id, req);
      set({ project: updated, dirty: false, dirtyFields: new Set() });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to save" });
    }
  },

  clearError: () => set({ error: null }),

  undo: () => {
    set((state) => {
      if (!state.project || state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      return {
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, state.project.layout.keys].slice(-MAX_UNDO),
        project: {
          ...state.project,
          layout: { ...state.project.layout, keys: prev },
        },
        ...markDirty(state, "layout"),
      };
    });
  },

  redo: () => {
    set((state) => {
      if (!state.project || state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      return {
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, state.project.layout.keys].slice(-MAX_UNDO),
        project: {
          ...state.project,
          layout: { ...state.project.layout, keys: next },
        },
        ...markDirty(state, "layout"),
      };
    });
  },

  pushUndo: () => {
    set((state) => {
      if (!state.project) return state;
      return {
        undoStack: [...state.undoStack, state.project.layout.keys].slice(-MAX_UNDO),
        redoStack: [],
      };
    });
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
        ...markDirty(state, "layout"),
      };
    });
  },

  addKey: (key) => {
    const { project, undoStack } = get();
    if (!project) return;
    set({
      undoStack: [...undoStack, project.layout.keys].slice(-MAX_UNDO),
      redoStack: [],
      project: {
        ...project,
        layout: {
          ...project.layout,
          keys: [...project.layout.keys, key],
        },
      },
      dirty: true,
      dirtyFields: new Set([...get().dirtyFields, "layout" as DirtyField]),
    });
  },

  removeKey: (keyId) => {
    const { project, undoStack, selectedKeyIds } = get();
    if (!project) return;
    set({
      undoStack: [...undoStack, project.layout.keys].slice(-MAX_UNDO),
      redoStack: [],
      project: {
        ...project,
        layout: {
          ...project.layout,
          keys: project.layout.keys.filter((k) => k.id !== keyId),
        },
      },
      dirty: true,
      dirtyFields: new Set([...get().dirtyFields, "layout" as DirtyField]),
      selectedKeyIds: selectedKeyIds.filter((id) => id !== keyId),
    });
  },

  setLayout: (layout) => {
    set((state) => {
      if (!state.project) return state;
      return {
        project: { ...state.project, layout },
        ...markDirty(state, "layout"),
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
        ...markDirty(state, "switch"),
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
        ...markDirty(state, "style"),
      };
    });
  },
}));
