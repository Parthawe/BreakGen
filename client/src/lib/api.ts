/**
 * API client for the BreakGen backend.
 */

import type {
  AcceptanceState,
  ExportPreview,
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
  QualityGateSummary,
  ProjectSummary,
  SupportedSwitch,
  UpdateProjectRequest,
  ValidationReport,
} from "../types/project";
import { API_BASE_URL } from "./runtime";

const BASE = API_BASE_URL;

type ApiErrorCode =
  | "network_error"
  | "unauthorized"
  | "revision_conflict"
  | "not_found"
  | "validation_error"
  | "server_error"
  | "unknown_error";

export interface AuthProvider {
  id: string;
  label: string;
  enabled: boolean;
  configured: boolean;
  status: string;
  reason: string;
  setup: string[];
}

export interface AuthProvidersResponse {
  password: AuthProvider;
  providers: AuthProvider[];
}

export class ApiError extends Error {
  status: number;
  detail: string;
  code: ApiErrorCode;
  body: unknown;

  constructor(
    status: number,
    detail: string,
    code: ApiErrorCode,
    body: unknown = null,
  ) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.code = code;
    this.body = body;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function extractRevisionConflict(
  value: string,
): { expectedRevision: number | null; currentRevision: number | null } {
  const match = value.match(/expected\s+(\d+),\s+current\s+is\s+(\d+)/i);
  if (!match) {
    return { expectedRevision: null, currentRevision: null };
  }
  return {
    expectedRevision: Number.parseInt(match[1], 10),
    currentRevision: Number.parseInt(match[2], 10),
  };
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("breakgen_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function classifyError(status: number, detail: string): ApiErrorCode {
  if (status === 0) return "network_error";
  if (status === 401) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 409 && /revision conflict/i.test(detail)) return "revision_conflict";
  if (status >= 400 && status < 500) return "validation_error";
  if (status >= 500) return "server_error";
  return "unknown_error";
}

async function parseErrorBody(res: Response): Promise<{ detail: string; body: unknown }> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await res.json()) as Record<string, unknown>;
      const detail =
        typeof body.detail === "string"
          ? body.detail
          : typeof body.message === "string"
            ? body.message
            : JSON.stringify(body);
      return { detail, body };
    } catch {
      return { detail: `API ${res.status}`, body: null };
    }
  }

  const detail = (await res.text()) || `API ${res.status}`;
  return { detail, body: detail };
}

async function requestResponse(path: string, options?: RequestInit): Promise<Response> {
  try {
    const url = /^https?:\/\//i.test(path) ? path : `${BASE}${path}`;
    return await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options?.headers ?? {}),
      },
    });
  } catch (error) {
    throw new ApiError(
      0,
      "Cannot reach the BreakGen backend. Start the API server or check the network path.",
      "network_error",
      error,
    );
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await requestResponse(path, options);
  if (!res.ok) {
    const { detail, body } = await parseErrorBody(res);
    throw new ApiError(res.status, detail, classifyError(res.status, detail), body);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function normalizeApiPath(pathOrUrl: string): string {
  if (pathOrUrl.startsWith(BASE)) return pathOrUrl.slice(BASE.length);
  return pathOrUrl;
}

async function downloadFile(pathOrUrl: string, fileName: string): Promise<void> {
  const path = normalizeApiPath(pathOrUrl);
  const res = await requestResponse(path, { method: "GET" });
  if (!res.ok) {
    const { detail, body } = await parseErrorBody(res);
    throw new ApiError(res.status, detail, classifyError(res.status, detail), body);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  auth: {
    providers: () => request<AuthProvidersResponse>("/auth/providers"),
    signup: (req: { email: string; name: string; password: string; invite_code?: string }) =>
      request<{ token: string; user: { id: number; email: string; name: string } }>(
        "/auth/signup",
        {
          method: "POST",
          body: JSON.stringify(req),
        },
      ),
    login: (req: { email: string; password: string }) =>
      request<{ token: string; user: { id: number; email: string; name: string } }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify(req),
        },
      ),
    me: () => request<{ id: number; email: string; name: string }>("/auth/me"),
  },

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
        source_revision: number;
        source_spec_hash: string;
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
    downloadFirmware: (projectId: string, fileName: string) =>
      downloadFile(`/projects/${projectId}/firmware/${fileName}`, fileName),
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
    downloadMechanicalArtifact: (projectId: string, artifactName: string) =>
      downloadFile(`/projects/${projectId}/export/mechanical/${artifactName}`, artifactName),
    downloadMechanicalArtifactUrl: (url: string, fileName: string) =>
      downloadFile(url, fileName),
  },

  export: {
    bundleUrl: (projectId: string) => `${BASE}/projects/${projectId}/export`,
    preview: (projectId: string) =>
      request<ExportPreview>(`/projects/${projectId}/export/preview`),
    download: (projectId: string) =>
      requestResponse(`/projects/${projectId}/export`, { method: "POST" }),
  },

  records: {
    get: (projectId: string) => request<ProjectRecords>(`/projects/${projectId}/records`),
    qualityGate: (projectId: string) =>
      request<QualityGateSummary>(`/projects/${projectId}/quality-gate`),
    downloadArtifact: (projectId: string, artifactId: string, fileName: string) =>
      downloadFile(
        `/projects/${projectId}/artifacts/${encodeURIComponent(artifactId)}/download`,
        fileName,
      ),
  },
};
