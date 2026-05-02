import type {
  ElementType,
  KeySpec,
  LayoutSpec,
  PlacedElementSpec,
  StabilizerType,
} from "../types/project";

const UNIT_PITCH_MM = 19.05;

export function elementSupportsLegacyKey(elementType: ElementType): boolean {
  return elementType === "key_switch" || elementType === "button";
}

export function keyToPlacedElement(
  key: KeySpec,
  unitPitchMm = UNIT_PITCH_MM,
  existing?: Partial<PlacedElementSpec>,
): PlacedElementSpec {
  const metadata = {
    ...(existing?.metadata ?? {}),
    rotation_origin_x_u: key.rotation_origin_x_u,
    rotation_origin_y_u: key.rotation_origin_y_u,
  };
  return {
    id: key.id,
    element_type: existing?.element_type ?? "key_switch",
    label: key.label,
    footprint_id: existing?.footprint_id ?? "mx_switch",
    x_mm: key.x_u * unitPitchMm,
    y_mm: key.y_u * unitPitchMm,
    w_mm: key.w_u * unitPitchMm,
    h_mm: key.h_u * unitPitchMm,
    rotation_deg: key.rotation_deg,
    mounting: existing?.mounting ?? {},
    appearance_ref: key.keycap_asset_id,
    electrical_ref: existing?.electrical_ref ?? null,
    metadata,
    stabilizer: key.stabilizer,
    keycap_asset_id: key.keycap_asset_id,
    row: key.row,
    col: key.col,
  };
}

export function elementToKeySpec(
  element: PlacedElementSpec,
  unitPitchMm = UNIT_PITCH_MM,
): KeySpec {
  const rotation_origin_x_u =
    typeof element.metadata.rotation_origin_x_u === "number"
      ? element.metadata.rotation_origin_x_u
      : 0;
  const rotation_origin_y_u =
    typeof element.metadata.rotation_origin_y_u === "number"
      ? element.metadata.rotation_origin_y_u
      : 0;

  return {
    id: element.id,
    label: element.label,
    x_u: element.x_mm / unitPitchMm,
    y_u: element.y_mm / unitPitchMm,
    w_u: element.w_mm / unitPitchMm,
    h_u: element.h_mm / unitPitchMm,
    rotation_deg: element.rotation_deg,
    rotation_origin_x_u,
    rotation_origin_y_u,
    stabilizer: (element.stabilizer ?? "none") as StabilizerType,
    keycap_asset_id: element.keycap_asset_id ?? element.appearance_ref ?? null,
    row: element.row,
    col: element.col,
  };
}

export function getEditableElements(layout: LayoutSpec): PlacedElementSpec[] {
  if (layout.elements?.length) return layout.elements;
  return layout.keys.map((key) => keyToPlacedElement(key, layout.unit_pitch_mm));
}

export function getLegacyKeys(layout: LayoutSpec): KeySpec[] {
  if (layout.elements?.length) {
    return layout.elements
      .filter((element) => elementSupportsLegacyKey(element.element_type))
      .map((element) => elementToKeySpec(element, layout.unit_pitch_mm));
  }
  return layout.keys;
}

export function syncLayoutWithElements(
  layout: LayoutSpec,
  elements: PlacedElementSpec[],
): LayoutSpec {
  return {
    ...layout,
    elements,
    keys: elements
      .filter((element) => elementSupportsLegacyKey(element.element_type))
      .map((element) => elementToKeySpec(element, layout.unit_pitch_mm)),
  };
}

export function countLayoutElements(layout: LayoutSpec): number {
  return getEditableElements(layout).length;
}
