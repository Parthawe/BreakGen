/**
 * TypeScript types matching the server's Pydantic domain models.
 * Source of truth: server/models/project.py
 *
 * Keep these in sync with the Pydantic models.
 */

// --- Enums ---

export type ProductDomain =
  | "control_surface"
  | "handheld"
  | "ambient_device"
  | "wearable";

export type ProductFamily =
  | "keyboard"
  | "macropad"
  | "streamdeck"
  | "midi"
  | "gamepad"
  | "pedal_controller"
  | "breath_controller"
  | "handheld_companion"
  | "retro_handheld"
  | "desktop_speaker"
  | "smart_lamp"
  | "sensor_pod";

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

export type ElementType =
  | "key_switch"
  | "encoder"
  | "button"
  | "slider"
  | "joystick"
  | "display"
  | "speaker"
  | "microphone"
  | "led_cluster"
  | "battery"
  | "usb_port"
  | "sensor"
  | "mounting_feature";

export type AcceptanceState =
  | "preview_only"
  | "candidate"
  | "accepted"
  | "rejected"
  | "production_ready";

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

export interface PlacedElementSpec {
  id: string;
  element_type: ElementType;
  label: string;
  footprint_id: string | null;
  x_mm: number;
  y_mm: number;
  w_mm: number;
  h_mm: number;
  rotation_deg: number;
  mounting: Record<string, unknown>;
  appearance_ref: string | null;
  electrical_ref: string | null;
  metadata: Record<string, unknown>;
  stabilizer: StabilizerType;
  keycap_asset_id: string | null;
  row: number | null;
  col: number | null;
}

// --- Layout ---

export interface LayoutSpec {
  unit_pitch_mm: number;
  keys: KeySpec[];
  elements: PlacedElementSpec[];
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
  acceptance_state: AcceptanceState;
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

export interface ValidationCheck {
  id: string;
  category: string;
  status: string;
  details: string;
}

export interface ValidationReport {
  report_id: string;
  project_id: string;
  revision: number;
  status: string;
  created_at: string;
  checks: ValidationCheck[];
}

export interface MechanicalCompileBase {
  project_id: string;
  revision: number;
  status: "compiled";
  mechanical_kind: "panel" | "shell";
  artifact_urls: Record<string, string>;
  artifact_ids: string[];
  compiled_at?: string | null;
}

export interface PanelMechanicalCompileResult extends MechanicalCompileBase {
  mechanical_kind: "panel";
  geometry_kind: string;
  key_count: number;
  element_count: number;
  cutout_summary: Record<string, number>;
  mounting_hole_count: number;
  plate_width_mm: number;
  plate_height_mm: number;
}

export interface ShellMechanicalCompileResult extends MechanicalCompileBase {
  mechanical_kind: "shell";
  shell_kind: string;
  outer_shell: Record<string, number>;
  front_features: Array<Record<string, unknown>>;
  rear_features: Array<Record<string, unknown>>;
  side_ports: Array<Record<string, unknown>>;
  mounting_holes: Array<Record<string, number>>;
  control_summary: Record<string, number>;
}

export type MechanicalCompileResult =
  | PanelMechanicalCompileResult
  | ShellMechanicalCompileResult;

// --- The canonical project model ---

export interface ProjectDocument {
  project_id: string;
  spec_version: number;
  product_domain: ProductDomain;
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
  metadata: Record<string, unknown>;
  derived: Record<string, unknown>;
  assets: Record<string, unknown>;
  jobs: Record<string, unknown>;
}

export type KeyboardProject = ProjectDocument;

// --- API request/response types ---

export interface CreateProjectRequest {
  name?: string;
  template_id?: string;
  product_domain?: ProductDomain;
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
  product_domain: ProductDomain;
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
  product_domain: ProductDomain;
  product_family: ProductFamily;
}

export interface ProductDomainManifest {
  domain: ProductDomain;
  display_name: string;
  description: string;
  enabled_families: ProductFamily[];
  status: "enabled" | "planned";
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

export interface WorkspaceStageManifest {
  id: string;
  label: string;
  description: string;
  requires_project: boolean;
  modules: string[];
  preview_mode: "none" | "3d";
}

export interface ProductFamilyManifest {
  domain: ProductDomain;
  family: ProductFamily;
  display_name: string;
  description: string;
  status: "enabled" | "planned";
  stages: WorkspaceStageManifest[];
  required_inputs: string[];
  supported_capabilities: string[];
  available_templates: string[];
  editor_modules: string[];
  supported_module_types: string[];
}

export interface HardwareModuleManifest {
  module_id: string;
  module_type: string;
  display_name: string;
  description: string;
  mechanical_constraints: Record<string, unknown>;
  electrical_constraints: Record<string, unknown>;
  mounting_requirements: Record<string, unknown>;
  supported_families: ProductFamily[];
  export_implications: string[];
  status: "enabled" | "planned";
}

export interface GenerationProviderManifest {
  id: string;
  display_name: string;
  description: string;
  status: "enabled" | "fallback" | "disabled" | "planned";
  feature_flag: string | null;
  supported_asset_types: string[];
  capabilities: string[];
  default_for: string[];
}

export interface ArtifactRecord {
  artifact_id: string;
  project_id: string;
  revision: number;
  kind: string;
  artifact_role: string;
  domain: string | null;
  family: string | null;
  source_revision: number;
  source_spec_hash: string | null;
  producer_kind: string | null;
  producer_id: string | null;
  lineage: Record<string, unknown>;
  acceptance_state: AcceptanceState | null;
  path: string;
  sha256: string | null;
  content_type: string | null;
  details: Record<string, unknown>;
  created_at: string | null;
}

export interface ProjectJobRecord {
  job_id: string;
  project_id: string;
  revision: number;
  job_type: string;
  status: string;
  provider: string | null;
  external_ref: string | null;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
}

export interface ProjectRecords {
  project_id: string;
  jobs: ProjectJobRecord[];
  artifacts: ArtifactRecord[];
  latest_validation: ArtifactRecord | null;
  latest_validation_report: ValidationReport | null;
  latest_export: ArtifactRecord | null;
}
