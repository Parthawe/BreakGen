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

// --- Projects ---

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
};
