"""
Deterministic handheld shell proof generator.

This compiler is intentionally narrower than the keyboard/control-surface panel
generator. It produces a two-piece handheld shell specification plus 2D DXF
reference files for the front shell and back cavity planning.

The goal is architectural proof, not full manufacturable enclosure CAD.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

import ezdxf

from server.models.project import ElementType, LayoutSpec, PlacedElementSpec


@dataclass
class HandheldShellConfig:
    shell_margin_mm: float = 14.0
    wall_thickness_mm: float = 2.6
    front_shell_depth_mm: float = 8.0
    back_shell_depth_mm: float = 16.0
    bezel_margin_mm: float = 2.0
    corner_radius_mm: float = 10.0
    screw_hole_diameter_mm: float = 2.4
    screw_hole_inset_mm: float = 8.0
    battery_clearance_mm: float = 2.0


@dataclass
class ShellFeature:
    id: str
    role: str
    x_mm: float
    y_mm: float
    w_mm: float
    h_mm: float
    shape: str
    metadata: dict = field(default_factory=dict)


def _authoritative_elements(layout: LayoutSpec) -> list[PlacedElementSpec]:
    return list(layout.elements)


def _bounds(elements: list[PlacedElementSpec]) -> dict[str, float]:
    min_x = min(element.x_mm for element in elements)
    min_y = min(element.y_mm for element in elements)
    max_x = max(element.x_mm + element.w_mm for element in elements)
    max_y = max(element.y_mm + element.h_mm for element in elements)
    return {
        "min_x": min_x,
        "min_y": min_y,
        "max_x": max_x,
        "max_y": max_y,
        "width": max_x - min_x,
        "height": max_y - min_y,
    }


def _outer_shell_bounds(layout: LayoutSpec, config: HandheldShellConfig) -> dict[str, float]:
    elements = _authoritative_elements(layout)
    if not elements:
        return {"x0": 0.0, "y0": 0.0, "x1": 0.0, "y1": 0.0, "width": 0.0, "height": 0.0}
    b = _bounds(elements)
    x0 = b["min_x"] - config.shell_margin_mm
    y0 = b["min_y"] - config.shell_margin_mm
    x1 = b["max_x"] + config.shell_margin_mm
    y1 = b["max_y"] + config.shell_margin_mm
    return {"x0": x0, "y0": y0, "x1": x1, "y1": y1, "width": x1 - x0, "height": y1 - y0}


def _edge_for_port(element: PlacedElementSpec, outer: dict[str, float]) -> str:
    distances = {
        "left": abs(element.x_mm - outer["x0"]),
        "right": abs(outer["x1"] - (element.x_mm + element.w_mm)),
        "top": abs(element.y_mm - outer["y0"]),
        "bottom": abs(outer["y1"] - (element.y_mm + element.h_mm)),
    }
    return min(distances, key=distances.get)


def compile_handheld_shell_spec(
    layout: LayoutSpec,
    config: HandheldShellConfig | None = None,
) -> dict:
    if config is None:
        config = HandheldShellConfig()

    elements = _authoritative_elements(layout)
    if not elements:
        return {
            "shell_kind": "two_piece_handheld_proof",
            "outer_shell": {"width_mm": 0.0, "height_mm": 0.0},
            "front_features": [],
            "rear_features": [],
            "side_ports": [],
            "mounting_holes": [],
            "control_summary": {},
        }

    outer = _outer_shell_bounds(layout, config)
    front_features: list[ShellFeature] = []
    rear_features: list[ShellFeature] = []
    side_ports: list[dict] = []
    summary: dict[str, int] = {}

    for element in elements:
        summary[element.element_type.value] = summary.get(element.element_type.value, 0) + 1
        if element.element_type == ElementType.DISPLAY:
            front_features.append(
                ShellFeature(
                    id=element.id,
                    role="display_window",
                    x_mm=element.x_mm + config.bezel_margin_mm,
                    y_mm=element.y_mm + config.bezel_margin_mm,
                    w_mm=max(element.w_mm - config.bezel_margin_mm * 2, 8.0),
                    h_mm=max(element.h_mm - config.bezel_margin_mm * 2, 8.0),
                    shape="rect",
                )
            )
        elif element.element_type == ElementType.BUTTON:
            front_features.append(
                ShellFeature(
                    id=element.id,
                    role="button_aperture",
                    x_mm=element.x_mm,
                    y_mm=element.y_mm,
                    w_mm=element.w_mm,
                    h_mm=element.h_mm,
                    shape="circle",
                    metadata={"diameter_mm": max(min(element.w_mm, element.h_mm) - 3.0, 8.0)},
                )
            )
        elif element.element_type == ElementType.SPEAKER:
            front_features.append(
                ShellFeature(
                    id=element.id,
                    role="speaker_grille",
                    x_mm=element.x_mm,
                    y_mm=element.y_mm,
                    w_mm=element.w_mm,
                    h_mm=element.h_mm,
                    shape="grille",
                    metadata={"hole_count": 7, "hole_diameter_mm": 3.0},
                )
            )
            rear_features.append(
                ShellFeature(
                    id=element.id,
                    role="speaker_clearance",
                    x_mm=element.x_mm,
                    y_mm=element.y_mm,
                    w_mm=element.w_mm,
                    h_mm=element.h_mm,
                    shape="circle",
                )
            )
        elif element.element_type == ElementType.BATTERY:
            rear_features.append(
                ShellFeature(
                    id=element.id,
                    role="battery_cavity",
                    x_mm=element.x_mm - config.battery_clearance_mm,
                    y_mm=element.y_mm - config.battery_clearance_mm,
                    w_mm=element.w_mm + config.battery_clearance_mm * 2,
                    h_mm=element.h_mm + config.battery_clearance_mm * 2,
                    shape="rect",
                    metadata={"depth_mm": 7.5},
                )
            )
        elif element.element_type == ElementType.USB_PORT:
            side_ports.append(
                {
                    "id": element.id,
                    "role": "usb_service_port",
                    "edge": _edge_for_port(element, outer),
                    "x_mm": element.x_mm,
                    "y_mm": element.y_mm,
                    "w_mm": element.w_mm,
                    "h_mm": element.h_mm,
                }
            )

    mounting_holes = [
        {"x_mm": outer["x0"] + config.screw_hole_inset_mm, "y_mm": outer["y0"] + config.screw_hole_inset_mm},
        {"x_mm": outer["x1"] - config.screw_hole_inset_mm, "y_mm": outer["y0"] + config.screw_hole_inset_mm},
        {"x_mm": outer["x1"] - config.screw_hole_inset_mm, "y_mm": outer["y1"] - config.screw_hole_inset_mm},
        {"x_mm": outer["x0"] + config.screw_hole_inset_mm, "y_mm": outer["y1"] - config.screw_hole_inset_mm},
    ]

    return {
        "shell_kind": "two_piece_handheld_proof",
        "outer_shell": {
            "width_mm": round(outer["width"], 2),
            "height_mm": round(outer["height"], 2),
            "x0": round(outer["x0"], 2),
            "y0": round(outer["y0"], 2),
            "x1": round(outer["x1"], 2),
            "y1": round(outer["y1"], 2),
            "wall_thickness_mm": config.wall_thickness_mm,
            "front_shell_depth_mm": config.front_shell_depth_mm,
            "back_shell_depth_mm": config.back_shell_depth_mm,
            "corner_radius_mm": config.corner_radius_mm,
        },
        "front_features": [asdict(feature) for feature in front_features],
        "rear_features": [asdict(feature) for feature in rear_features],
        "side_ports": side_ports,
        "mounting_holes": mounting_holes,
        "control_summary": summary,
    }


def _add_rect(msp, x: float, y: float, w: float, h: float, layer: str):
    msp.add_lwpolyline(
        [(x, y), (x + w, y), (x + w, y + h), (x, y + h)],
        close=True,
        dxfattribs={"layer": layer},
    )


def _write_front_panel(spec: dict, output_path: Path, config: HandheldShellConfig):
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    doc.layers.add("Outline", color=5)
    doc.layers.add("Cutouts", color=1)
    doc.layers.add("MountingHoles", color=3)

    outer = spec["outer_shell"]
    _add_rect(msp, outer["x0"], outer["y0"], outer["width_mm"], outer["height_mm"], "Outline")

    for feature in spec["front_features"]:
        if feature["shape"] == "rect":
            _add_rect(msp, feature["x_mm"], feature["y_mm"], feature["w_mm"], feature["h_mm"], "Cutouts")
        elif feature["shape"] == "circle":
            diameter = feature["metadata"]["diameter_mm"]
            msp.add_circle(
                (feature["x_mm"] + feature["w_mm"] / 2, feature["y_mm"] + feature["h_mm"] / 2),
                diameter / 2,
                dxfattribs={"layer": "Cutouts"},
            )
        elif feature["shape"] == "grille":
            cx = feature["x_mm"] + feature["w_mm"] / 2
            cy = feature["y_mm"] + feature["h_mm"] / 2
            radius = min(feature["w_mm"], feature["h_mm"]) * 0.22
            hole_d = feature["metadata"]["hole_diameter_mm"]
            msp.add_circle((cx, cy), hole_d / 2, dxfattribs={"layer": "Cutouts"})
            for dx, dy in [(radius, 0), (-radius, 0), (0, radius), (0, -radius), (radius * 0.7, radius * 0.7), (-radius * 0.7, radius * 0.7)]:
                msp.add_circle((cx + dx, cy + dy), hole_d / 2, dxfattribs={"layer": "Cutouts"})

    for hole in spec["mounting_holes"]:
        msp.add_circle(
            (hole["x_mm"], hole["y_mm"]),
            config.screw_hole_diameter_mm / 2,
            dxfattribs={"layer": "MountingHoles"},
        )

    doc.saveas(str(output_path))


def _write_back_reference(spec: dict, output_path: Path, config: HandheldShellConfig):
    doc = ezdxf.new("R2010")
    msp = doc.modelspace()
    doc.layers.add("Outline", color=5)
    doc.layers.add("Reference", color=2)
    doc.layers.add("Ports", color=4)

    outer = spec["outer_shell"]
    _add_rect(msp, outer["x0"], outer["y0"], outer["width_mm"], outer["height_mm"], "Outline")

    for feature in spec["rear_features"]:
        _add_rect(msp, feature["x_mm"], feature["y_mm"], feature["w_mm"], feature["h_mm"], "Reference")

    for port in spec["side_ports"]:
        _add_rect(msp, port["x_mm"], port["y_mm"], port["w_mm"], port["h_mm"], "Ports")

    doc.saveas(str(output_path))


def generate_handheld_shell_artifacts(
    layout: LayoutSpec,
    output_dir: Path | str,
    config: HandheldShellConfig | None = None,
) -> dict:
    if config is None:
        config = HandheldShellConfig()
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    spec = compile_handheld_shell_spec(layout, config)
    front_path = output_dir / "front_shell_panel.dxf"
    back_path = output_dir / "back_shell_reference.dxf"
    spec_path = output_dir / "shell_spec.json"

    _write_front_panel(spec, front_path, config)
    _write_back_reference(spec, back_path, config)
    spec_path.write_text(json.dumps(spec, indent=2))

    return {
        "spec": spec,
        "front_panel_path": str(front_path),
        "back_reference_path": str(back_path),
        "spec_path": str(spec_path),
    }
