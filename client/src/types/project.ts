/**
 * TypeScript types matching the server's Pydantic domain models.
 * Source of truth: server/models/project.py
 *
 * Keep these in sync with the Pydantic models.
 */

// --- Enums ---

export type ProductFamily = "keyboard" | "macropad" | "streamdeck" | "midi";

export type ProjectStatus =
  | "draft"
  | "configured"
  | "generating"
  | "previewable"
  | "validated"
  | "exported";

export type SwitchFamily = "mx" | "choc_v1" | "choc_v2";

export type DiodeDirection = "COL2ROW" | "ROW2COL";

export type ControllerFamily = "rp2040" | "atmega32u4";

export type StabilizerType = "cherry" | "costar" | "none";

// --- Key ---

export interface KeySpec {
  id: string;
  label: string;
  x_u: number;
  y_u: number;
  w_u: number;
  h_u: number;
  rotation_deg: number;
  rotation_origin_x_u: number;
  rotation_origin_y_u: number;
  stabilizer: StabilizerType;
  keycap_asset_id: string | null;
  row: number | null;
  col: number | null;
}

// --- Layout ---

export interface LayoutSpec {
  unit_pitch_mm: number;
  keys: KeySpec[];
}

// --- Switch ---

export interface SwitchProfile {
  family: SwitchFamily;
  part_id: string | null;
}

// --- Keycap style ---

export interface StyleRequest {
  provider: string;
  prompt: string | null;
  preset: string | null;
  variant_count: number;
}

export interface KeycapAsset {
  asset_id: string;
  source: string;
  provider: string | null;
  prompt: string | null;
  mesh_path: string | null;
  preview_mesh_path: string | null;
  unit_sizes: number[];
  normalized: boolean;
  watertight: boolean;
}

// --- PCB ---

export interface PCBSpec {
  controller: ControllerFamily;
  matrix_mode: string;
  diode_direction: DiodeDirection;
  matrix_rows: number | null;
  matrix_cols: number | null;
  board_outline_source: string;
  drc_passed: boolean | null;
  gerber_path: string | null;
  kicad_project_path: string | null;
}

// --- Export ---

export interface ExportState {
  bundle_id: string | null;
  bundle_path: string | null;
  exported_at: string | null;
  validation_report_id: string | null;
}

// --- The canonical project model ---

export interface KeyboardProject {
  project_id: string;
  product_family: ProductFamily;
  name: string;
  revision: number;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  template: string | null;
  layout: LayoutSpec;
  switch_profile: SwitchProfile;
  style_request: StyleRequest;
  keycap_assets: KeycapAsset[];
  pcb: PCBSpec;
  exports: ExportState;
}

// --- API request/response types ---

export interface CreateProjectRequest {
  name?: string;
  template_id?: string;
  product_family?: ProductFamily;
}

export interface UpdateProjectRequest {
  name?: string;
  layout?: LayoutSpec;
  switch_part_id?: string;
  style_prompt?: string;
  expected_revision?: number;
}

export interface ProjectSummary {
  project_id: string;
  product_family: ProductFamily;
  name: string;
  revision: number;
  status: ProjectStatus;
  template: string | null;
  key_count: number;
  created_at: string;
  updated_at: string;
}

export interface LayoutTemplate {
  template_id: string;
  name: string;
  description: string;
  key_count: number;
  product_family: ProductFamily;
}

export interface SupportedSwitch {
  part_id: string;
  name: string;
  manufacturer: string;
  family: SwitchFamily;
  switch_type: string;
  actuation_force_g: number;
  total_travel_mm: number;
  tags: string[];
}
