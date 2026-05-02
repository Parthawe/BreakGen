"""Family-aware electronics compilation for control-surface products."""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass

from server.eda.matrix_compiler import MatrixAssignment, compile_matrix
from server.models.project import ElementType, KeyboardProject, LayoutSpec, ProductFamily

MATRIX_ELEMENT_TYPES = {ElementType.KEY_SWITCH, ElementType.BUTTON}
DIRECT_PIN_REQUIREMENTS = {
    ElementType.ENCODER: 2,
    ElementType.JOYSTICK: 3,
    ElementType.DISPLAY: 4,
    ElementType.SLIDER: 1,
    ElementType.SPEAKER: 2,
    ElementType.MICROPHONE: 1,
    ElementType.LED_CLUSTER: 1,
    ElementType.SENSOR: 2,
    ElementType.BATTERY: 0,
    ElementType.USB_PORT: 0,
    ElementType.MOUNTING_FEATURE: 0,
    ElementType.KEY_SWITCH: 0,
    ElementType.BUTTON: 0,
}
GPIO_BUDGET = {
    "rp2040": 26,
    "atmega32u4": 18,
}


@dataclass
class DirectPinUsage:
    element_type: str
    control_count: int
    pins_per_control: int
    total_pins: int


@dataclass
class ElectronicsCompileResult:
    matrix: MatrixAssignment
    matrix_strategy: str
    matrix_control_count: int
    direct_control_count: int
    matrix_pins: int
    direct_pins: int
    total_pins: int
    gpio_budget: int
    gpio_remaining: int
    firmware_target: str
    control_protocol: str
    direct_pin_usage: list[DirectPinUsage]

    def model_dump(self) -> dict:
        return {
            "matrix_rows": self.matrix.matrix_rows,
            "matrix_cols": self.matrix.matrix_cols,
            "matrix_assignments": dict(self.matrix.assignments),
            "matrix_strategy": self.matrix_strategy,
            "matrix_control_count": self.matrix_control_count,
            "direct_control_count": self.direct_control_count,
            "matrix_pins": self.matrix_pins,
            "direct_pins": self.direct_pins,
            "pins_needed": self.total_pins,
            "gpio_budget": self.gpio_budget,
            "gpio_remaining": self.gpio_remaining,
            "firmware_target": self.firmware_target,
            "control_protocol": self.control_protocol,
            "direct_pin_usage": [asdict(item) for item in self.direct_pin_usage],
        }


def firmware_target_for_family(family: ProductFamily) -> str:
    if family == ProductFamily.MIDI:
        return "midi_control_surface"
    if family == ProductFamily.GAMEPAD:
        return "hid_gamepad"
    if family == ProductFamily.HANDHELD_COMPANION:
        return "handheld_companion_proof"
    if family == ProductFamily.STREAMDECK:
        return "hid_macro_pad"
    if family == ProductFamily.MACROPAD:
        return "hid_macro_pad"
    return "qmk_via_keyboard"


def control_protocol_for_family(family: ProductFamily) -> str:
    if family == ProductFamily.MIDI:
        return "usb_midi"
    if family == ProductFamily.GAMEPAD:
        return "usb_hid_gamepad"
    if family == ProductFamily.HANDHELD_COMPANION:
        return "usb_hid_companion"
    if family in {ProductFamily.MACROPAD, ProductFamily.STREAMDECK}:
        return "usb_hid_macro"
    return "usb_hid_keyboard"


def _matrix_keys(layout: LayoutSpec):
    return list(layout.keys)


def _balanced_matrix(keys) -> MatrixAssignment:
    if not keys:
        return MatrixAssignment(
            matrix_rows=0,
            matrix_cols=0,
            assignments={},
            row_pins_needed=0,
            col_pins_needed=0,
        )

    ordered = sorted(keys, key=lambda key: (key.y_u, key.x_u))
    key_count = len(ordered)
    best_rows = 1
    best_cols = key_count
    best_cost = best_rows + best_cols
    best_balance = abs(best_rows - best_cols)

    for rows in range(1, key_count + 1):
        cols = math.ceil(key_count / rows)
        cost = rows + cols
        balance = abs(rows - cols)
        if cost < best_cost or (cost == best_cost and balance < best_balance):
            best_rows = rows
            best_cols = cols
            best_cost = cost
            best_balance = balance

    assignments: dict[str, tuple[int, int]] = {}
    for index, key in enumerate(ordered):
        row = index // best_cols
        col = index % best_cols
        assignments[key.id] = (row, col)

    return MatrixAssignment(
        matrix_rows=best_rows,
        matrix_cols=best_cols,
        assignments=assignments,
        row_pins_needed=best_rows,
        col_pins_needed=best_cols,
    )


def compile_project_matrix(project: KeyboardProject) -> tuple[MatrixAssignment, str]:
    """Compile a family-aware matrix assignment for a project."""
    if project.product_family in {ProductFamily.MIDI, ProductFamily.GAMEPAD}:
        return _balanced_matrix(_matrix_keys(project.layout)), "balanced"
    return compile_matrix(project.layout), "physical_rows"


def compile_control_surface_electronics(project: KeyboardProject) -> ElectronicsCompileResult:
    """Compile a project into matrix/direct-pin electronics metadata."""
    matrix, strategy = compile_project_matrix(project)
    matrix_pins = matrix.row_pins_needed + matrix.col_pins_needed

    direct_pin_usage: list[DirectPinUsage] = []
    direct_control_count = 0
    direct_pins = 0
    for element_type in ElementType:
        if element_type in MATRIX_ELEMENT_TYPES:
            continue
        count = sum(1 for element in project.layout.elements if element.element_type == element_type)
        if count == 0:
            continue
        pins_per_control = DIRECT_PIN_REQUIREMENTS.get(element_type, 0)
        total_pins = count * pins_per_control
        direct_control_count += count
        direct_pins += total_pins
        direct_pin_usage.append(
            DirectPinUsage(
                element_type=element_type.value,
                control_count=count,
                pins_per_control=pins_per_control,
                total_pins=total_pins,
            )
        )

    total_pins = matrix_pins + direct_pins
    gpio_budget = GPIO_BUDGET.get(project.pcb.controller.value, 26)
    matrix_control_count = len(_matrix_keys(project.layout))

    return ElectronicsCompileResult(
        matrix=matrix,
        matrix_strategy=strategy,
        matrix_control_count=matrix_control_count,
        direct_control_count=direct_control_count,
        matrix_pins=matrix_pins,
        direct_pins=direct_pins,
        total_pins=total_pins,
        gpio_budget=gpio_budget,
        gpio_remaining=gpio_budget - total_pins,
        firmware_target=firmware_target_for_family(project.product_family),
        control_protocol=control_protocol_for_family(project.product_family),
        direct_pin_usage=direct_pin_usage,
    )


def apply_project_matrix(project: KeyboardProject, matrix: MatrixAssignment) -> KeyboardProject:
    """Apply the compiled matrix back to the project's layout."""
    for element in project.layout.elements:
        if element.id in matrix.assignments:
            row, col = matrix.assignments[element.id]
            element.row = row
            element.col = col
    project.layout = LayoutSpec(
        unit_pitch_mm=project.layout.unit_pitch_mm,
        elements=[element.model_dump(mode="json") for element in project.layout.elements],
    )
    return project
