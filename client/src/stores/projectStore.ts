/**
 * Zustand store — canonical client-side state for the current project.
 *
 * The project is element-backed. Legacy key views are regenerated from
 * `layout.elements` so existing APIs remain compatible while the editor
 * can work with generic controls.
 */

import { create } from "zustand";
import {
  getEditableElements,
  keyToPlacedElement,
  syncLayoutWithElements,
} from "../lib/projectCompat";
import { api, extractRevisionConflict, isApiError } from "../lib/api";
import { useAuthStore } from "./authStore";
import type {
  KeyboardProject,
  KeySpec,
  LayoutSpec,
  PlacedElementSpec,
  ProductDomain,
  ProductFamily,
  UpdateProjectRequest,
} from "../types/project";

type DirtyField = "name" | "layout" | "switch" | "style";

const MAX_UNDO = 50;

interface RevisionConflict {
  projectId: string;
  expectedRevision: number | null;
  currentRevision: number | null;
  message: string;
}

interface ProjectStore {
  project: KeyboardProject | null;
  loading: boolean;
  dirty: boolean;
  dirtyFields: Set<DirtyField>;
  selectedElementIds: string[];
  error: string | null;
  revisionConflict: RevisionConflict | null;
  undoStack: PlacedElementSpec[][];
  redoStack: PlacedElementSpec[][];

  loadProject: (id: string) => Promise<void>;
  createProject: (
    name: string,
    templateId?: string,
    productFamily?: ProductFamily,
    productDomain?: ProductDomain,
  ) => Promise<void>;
  save: () => Promise<void>;
  clearError: () => void;
  dismissRevisionConflict: () => void;
  reloadLatest: () => Promise<void>;
  undo: () => void;
  redo: () => void;

  pushUndo: () => void;
  updateElement: (elementId: string, updates: Partial<PlacedElementSpec>) => void;
  addElement: (element: PlacedElementSpec) => void;
  removeElement: (elementId: string) => void;
  setLayout: (layout: LayoutSpec) => void;

  // Compatibility wrappers for older keyboard-oriented callers.
  updateKey: (keyId: string, updates: Partial<KeySpec>) => void;
  addKey: (key: KeySpec) => void;
  removeKey: (keyId: string) => void;

  selectElement: (elementId: string, multi?: boolean) => void;
  clearSelection: () => void;

  setSwitch: (partId: string) => void;
  setStylePrompt: (prompt: string) => void;
}

function markDirty(state: { dirtyFields: Set<DirtyField> }, field: DirtyField) {
  const next = new Set(state.dirtyFields);
  next.add(field);
  return { dirty: true, dirtyFields: next };
}

function withElements(project: KeyboardProject, elements: PlacedElementSpec[]): KeyboardProject {
  return {
    ...project,
    layout: syncLayoutWithElements(project.layout, elements),
  };
}

function projectElements(project: KeyboardProject | null): PlacedElementSpec[] {
  return project ? getEditableElements(project.layout) : [];
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  loading: false,
  dirty: false,
  dirtyFields: new Set(),
  selectedElementIds: [],
  error: null,
  revisionConflict: null,
  undoStack: [],
  redoStack: [],

  loadProject: async (id) => {
    set({ loading: true, error: null, revisionConflict: null });
    try {
      const project = await api.projects.get(id);
      set({
        project,
        loading: false,
        dirty: false,
        dirtyFields: new Set(),
        selectedElementIds: [],
        revisionConflict: null,
        undoStack: [],
        redoStack: [],
      });
    } catch (e) {
      if (isApiError(e) && e.status === 401) {
        useAuthStore
          .getState()
          .handleUnauthorized("Your session expired while loading this project. Sign in again to continue.");
      }
      set({ loading: false, error: e instanceof Error ? e.message : "Failed to load project" });
    }
  },

  createProject: async (name, templateId, productFamily, productDomain) => {
    set({ loading: true, error: null, revisionConflict: null });
    try {
      const project = await api.projects.create({
        name,
        template_id: templateId,
        product_family: productFamily,
        product_domain: productDomain,
      });
      set({
        project,
        loading: false,
        dirty: false,
        dirtyFields: new Set(),
        selectedElementIds: [],
        revisionConflict: null,
        undoStack: [],
        redoStack: [],
      });
    } catch (e) {
      if (isApiError(e) && e.status === 401) {
        useAuthStore
          .getState()
          .handleUnauthorized("Your session expired while creating a project. Sign in again to continue.");
      }
      set({ loading: false, error: e instanceof Error ? e.message : "Failed to create project" });
    }
  },

  save: async () => {
    const { project, dirtyFields } = get();
    if (!project || dirtyFields.size === 0) return;

    set({ error: null, revisionConflict: null, loading: true });
    try {
      const req: UpdateProjectRequest = {
        expected_revision: project.revision,
      };
      if (dirtyFields.has("name")) req.name = project.name;
      if (dirtyFields.has("layout")) req.layout = project.layout;
      if (dirtyFields.has("switch")) req.switch_part_id = project.switch_profile.part_id ?? undefined;
      if (dirtyFields.has("style")) req.style_prompt = project.style_request.prompt ?? undefined;

      const updated = await api.projects.update(project.project_id, req);
      set({
        project: updated,
        dirty: false,
        dirtyFields: new Set(),
        loading: false,
        revisionConflict: null,
      });
    } catch (e) {
      if (isApiError(e)) {
        if (e.status === 401) {
          useAuthStore
            .getState()
            .handleUnauthorized("Your session expired before this revision could be saved. Sign in again to continue.");
        }
        if (e.code === "revision_conflict") {
          const revisions = extractRevisionConflict(e.detail);
          set({
            loading: false,
            revisionConflict: {
              projectId: project.project_id,
              expectedRevision: revisions.expectedRevision,
              currentRevision: revisions.currentRevision,
              message:
                "Another saved revision exists on the server. Reload the latest project state before continuing.",
            },
          });
          return;
        }
      }
      set({ loading: false, error: e instanceof Error ? e.message : "Failed to save" });
    }
  },

  clearError: () => set({ error: null }),
  dismissRevisionConflict: () => set({ revisionConflict: null }),
  reloadLatest: async () => {
    const projectId = get().project?.project_id;
    if (!projectId) return;
    await get().loadProject(projectId);
  },

  undo: () => {
    set((state) => {
      if (!state.project || state.undoStack.length === 0) return state;
      const prev = state.undoStack[state.undoStack.length - 1];
      const current = projectElements(state.project);
      return {
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, current].slice(-MAX_UNDO),
        project: withElements(state.project, prev),
        ...markDirty(state, "layout"),
      };
    });
  },

  redo: () => {
    set((state) => {
      if (!state.project || state.redoStack.length === 0) return state;
      const next = state.redoStack[state.redoStack.length - 1];
      const current = projectElements(state.project);
      return {
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, current].slice(-MAX_UNDO),
        project: withElements(state.project, next),
        ...markDirty(state, "layout"),
      };
    });
  },

  pushUndo: () => {
    set((state) => {
      if (!state.project) return state;
      return {
        undoStack: [...state.undoStack, projectElements(state.project)].slice(-MAX_UNDO),
        redoStack: [],
      };
    });
  },

  updateElement: (elementId, updates) => {
    set((state) => {
      if (!state.project) return state;
      const elements = projectElements(state.project).map((element) =>
        element.id === elementId ? { ...element, ...updates } : element,
      );
      return {
        project: withElements(state.project, elements),
        ...markDirty(state, "layout"),
      };
    });
  },

  addElement: (element) => {
    const { project, undoStack } = get();
    if (!project) return;
    const elements = projectElements(project);
    set({
      undoStack: [...undoStack, elements].slice(-MAX_UNDO),
      redoStack: [],
      project: withElements(project, [...elements, element]),
      dirty: true,
      dirtyFields: new Set([...get().dirtyFields, "layout" as DirtyField]),
      selectedElementIds: [element.id],
    });
  },

  removeElement: (elementId) => {
    const { project, undoStack, selectedElementIds } = get();
    if (!project) return;
    const elements = projectElements(project);
    set({
      undoStack: [...undoStack, elements].slice(-MAX_UNDO),
      redoStack: [],
      project: withElements(project, elements.filter((element) => element.id !== elementId)),
      dirty: true,
      dirtyFields: new Set([...get().dirtyFields, "layout" as DirtyField]),
      selectedElementIds: selectedElementIds.filter((id) => id !== elementId),
    });
  },

  setLayout: (layout) => {
    set((state) => {
      if (!state.project) return state;
      return {
        project: { ...state.project, layout: syncLayoutWithElements(layout, getEditableElements(layout)) },
        ...markDirty(state, "layout"),
      };
    });
  },

  updateKey: (keyId, updates) => {
    set((state) => {
      if (!state.project) return state;
      const project = state.project;
      const elements = projectElements(project).map((element) => {
        if (element.id !== keyId) return element;
        const key = project.layout.keys.find((item) => item.id === keyId);
        const nextKey: KeySpec = {
          ...(key ?? {
            id: element.id,
            label: element.label,
            x_u: element.x_mm / project.layout.unit_pitch_mm,
            y_u: element.y_mm / project.layout.unit_pitch_mm,
            w_u: element.w_mm / project.layout.unit_pitch_mm,
            h_u: element.h_mm / project.layout.unit_pitch_mm,
            rotation_deg: element.rotation_deg,
            rotation_origin_x_u: 0,
            rotation_origin_y_u: 0,
            stabilizer: element.stabilizer,
            keycap_asset_id: element.keycap_asset_id,
            row: element.row,
            col: element.col,
          }),
          ...updates,
        };
        return keyToPlacedElement(nextKey, project.layout.unit_pitch_mm, element);
      });
      return {
        project: withElements(project, elements),
        ...markDirty(state, "layout"),
      };
    });
  },

  addKey: (key) => {
    const project = get().project;
    if (!project) return;
    get().addElement(keyToPlacedElement(key, project.layout.unit_pitch_mm));
  },

  removeKey: (keyId) => {
    get().removeElement(keyId);
  },

  selectElement: (elementId, multi = false) => {
    set((state) => {
      if (multi) {
        const ids = state.selectedElementIds.includes(elementId)
          ? state.selectedElementIds.filter((id) => id !== elementId)
          : [...state.selectedElementIds, elementId];
        return { selectedElementIds: ids };
      }
      return { selectedElementIds: [elementId] };
    });
  },

  clearSelection: () => set({ selectedElementIds: [] }),

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
