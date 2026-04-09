/**
 * API client for the BreakGen backend.
 */

import type {
  CreateProjectRequest,
  KeyboardProject,
  LayoutTemplate,
  ProjectSummary,
  SupportedSwitch,
  UpdateProjectRequest,
} from "../types/project";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API ${res.status}: ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  projects: {
    list: () => request<ProjectSummary[]>("/projects/"),
    get: (id: string) => request<KeyboardProject>(`/projects/${id}`),
    create: (req: CreateProjectRequest) =>
      request<KeyboardProject>("/projects/", {
        method: "POST",
        body: JSON.stringify(req),
      }),
    update: (id: string, req: UpdateProjectRequest) =>
      request<KeyboardProject>(`/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(req),
      }),
    delete: (id: string) =>
      request<void>(`/projects/${id}`, { method: "DELETE" }),
  },

  templates: {
    list: () => request<LayoutTemplate[]>("/templates/"),
    get: (id: string) => request<Record<string, unknown>>(`/templates/${id}`),
  },

  switches: {
    list: () => request<SupportedSwitch[]>("/switches/"),
  },

  // Keycap generation
  keycaps: {
    presets: () => request<{ id: string; description: string }[]>("/projects/presets/keycap-styles"),
    generate: (projectId: string, prompt?: string, preset?: string) =>
      request<{ status: string; variants: unknown[]; prompt_used: string; message?: string }>(
        `/projects/${projectId}/generate-keycaps`,
        { method: "POST", body: JSON.stringify({ prompt, preset, variant_count: 4 }) }
      ),
    apply: (projectId: string, assetId: string, keyIds?: string[]) =>
      request<{ applied_to: number; asset_id: string; revision: number }>(
        `/projects/${projectId}/apply-keycap`,
        { method: "POST", body: JSON.stringify({ asset_id: assetId, key_ids: keyIds ?? null }) }
      ),
  },

  // PCB + firmware
  pcb: {
    compile: (projectId: string) =>
      request<{ matrix_rows: number; matrix_cols: number; pins_needed: number; revision: number }>(
        `/projects/${projectId}/compile/pcb`,
        { method: "POST" }
      ),
    firmwareInfo: (projectId: string) =>
      request<Record<string, unknown>>(`/projects/${projectId}/firmware/info.json`),
    keymap: (projectId: string) =>
      request<Record<string, unknown>>(`/projects/${projectId}/firmware/keymap.json`),
    via: (projectId: string) =>
      request<Record<string, unknown>>(`/projects/${projectId}/firmware/via.json`),
  },

  // Validation + export
  validation: {
    run: (projectId: string) =>
      request<{ status: string; checks: { id: string; category: string; status: string; details: string }[] }>(
        `/projects/${projectId}/validate`,
        { method: "POST" }
      ),
  },

  geometry: {
    compilePlate: (projectId: string) =>
      request<{ plate_width_mm: number; plate_height_mm: number; key_count: number }>(
        `/projects/${projectId}/compile/plate`,
        { method: "POST", body: JSON.stringify({}) }
      ),
    plateUrl: (projectId: string) => `${BASE}/projects/${projectId}/export/plate.dxf`,
  },

  export: {
    bundleUrl: (projectId: string) => `${BASE}/projects/${projectId}/export`,
  },
};
