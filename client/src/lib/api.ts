/**
 * API client for the BreakGen backend.
 */

import type {
  AcceptanceState,
  GenerationProviderManifest,
  CreateProjectRequest,
  KeycapAsset,
  HardwareModuleManifest,
  KeyboardProject,
  LayoutTemplate,
  MechanicalCompileResult,
  PanelMechanicalCompileResult,
  ProductDomainManifest,
  ProductFamilyManifest,
  ProjectRecords,
  ProjectSummary,
  SupportedSwitch,
  UpdateProjectRequest,
  ValidationReport,
} from "../types/project";

const BASE = "/api";

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("breakgen_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function requestResponse(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options?.headers ?? {}),
    },
  });
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await requestResponse(path, options);
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
    list: (family?: string, domain?: string) => {
      const params = new URLSearchParams();
      if (family) params.set("family", family);
      if (domain) params.set("domain", domain);
      const query = params.toString();
      return request<LayoutTemplate[]>(`/templates/${query ? `?${query}` : ""}`);
    },
    get: (id: string) => request<Record<string, unknown>>(`/templates/${id}`),
  },

  platform: {
    productDomains: () => request<ProductDomainManifest[]>("/product-domains"),
    productFamilies: () => request<ProductFamilyManifest[]>("/product-families"),
    hardwareModules: (family?: string, domain?: string) => {
      const params = new URLSearchParams();
      if (family) params.set("family", family);
      if (domain) params.set("domain", domain);
      const query = params.toString();
      return request<HardwareModuleManifest[]>(`/hardware-modules${query ? `?${query}` : ""}`);
    },
    providers: () => request<GenerationProviderManifest[]>("/generation/providers"),
  },

  switches: {
    list: () => request<SupportedSwitch[]>("/switches/"),
  },

  // Keycap generation
  keycaps: {
    presets: () => request<{ id: string; description: string }[]>("/projects/presets/keycap-styles"),
    generate: (projectId: string, prompt?: string, preset?: string, provider?: string) =>
      request<{ status: string; provider: string; variants?: KeycapAsset[]; prompt_used: string; message?: string; variant_count?: number }>(
        `/projects/${projectId}/generate-keycaps`,
        { method: "POST", body: JSON.stringify({ prompt, preset, provider, variant_count: 4 }) }
      ),
    updateAcceptance: (
      projectId: string,
      assetId: string,
      acceptanceState: AcceptanceState,
      expectedRevision?: number,
    ) =>
      request<{ asset_id: string; acceptance_state: AcceptanceState; revision: number }>(
        `/projects/${projectId}/keycap-assets/${assetId}/acceptance`,
        {
          method: "POST",
          body: JSON.stringify({
            acceptance_state: acceptanceState,
            expected_revision: expectedRevision ?? null,
          }),
        }
      ),
    apply: (
      projectId: string,
      assetId: string,
      expectedRevision: number,
      elementIds?: string[],
    ) =>
      request<{ applied_to: number; asset_id: string; revision: number }>(
        `/projects/${projectId}/apply-keycap`,
        {
          method: "POST",
          body: JSON.stringify({
            asset_id: assetId,
            expected_revision: expectedRevision,
            element_ids: elementIds ?? null,
          }),
        }
      ),
  },

  // PCB + firmware
  pcb: {
    compile: (projectId: string) =>
      request<{
        matrix_rows: number;
        matrix_cols: number;
        matrix_strategy: string;
        matrix_controls: number;
        direct_controls: number;
        matrix_pins: number;
        direct_pins: number;
        pins_needed: number;
        gpio_budget: number;
        gpio_remaining: number;
        firmware_target: string;
        control_protocol: string;
        direct_pin_usage: Array<{
          element_type: string;
          control_count: number;
          pins_per_control: number;
          total_pins: number;
        }>;
        revision: number;
      }>(
        `/projects/${projectId}/compile/pcb`,
        { method: "POST" }
      ),
    firmwareInfo: (projectId: string) =>
      request<Record<string, unknown>>(`/projects/${projectId}/firmware/info.json`),
    keymap: (projectId: string) =>
      request<Record<string, unknown>>(`/projects/${projectId}/firmware/keymap.json`),
    via: (projectId: string) =>
      request<Record<string, unknown>>(`/projects/${projectId}/firmware/via.json`),
    controlMap: (projectId: string) =>
      request<Record<string, unknown>>(`/projects/${projectId}/firmware/control-map.json`),
  },

  // Validation + export
  validation: {
    run: (projectId: string) =>
      request<ValidationReport>(
        `/projects/${projectId}/validate`,
        { method: "POST" }
      ),
  },

  geometry: {
    compilePlate: (projectId: string) =>
      request<PanelMechanicalCompileResult>(
        `/projects/${projectId}/compile/plate`,
        { method: "POST", body: JSON.stringify({}) }
      ),
    compileMechanical: (projectId: string) =>
      request<MechanicalCompileResult>(
        `/projects/${projectId}/compile/mechanical`,
        { method: "POST", body: JSON.stringify({}) }
      ),
    plateUrl: (projectId: string) => `${BASE}/projects/${projectId}/export/plate.dxf`,
    mechanicalArtifactUrl: (projectId: string, artifactName: string) =>
      `${BASE}/projects/${projectId}/export/mechanical/${artifactName}`,
  },

  export: {
    bundleUrl: (projectId: string) => `${BASE}/projects/${projectId}/export`,
    download: (projectId: string) =>
      requestResponse(`/projects/${projectId}/export`, { method: "POST" }),
  },

  records: {
    get: (projectId: string) => request<ProjectRecords>(`/projects/${projectId}/records`),
  },
};
