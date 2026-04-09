"""Tests for the plate geometry generator."""

import json
import tempfile
from pathlib import Path

from server.geometry.plate_generator import (
    PlateConfig,
    generate_plate_dxf,
    get_plate_bounds,
    MX_CUTOUT_MM,
    UNIT_MM,
)
from server.models.project import KeySpec, LayoutSpec


TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


def _load_layout(template_id: str) -> LayoutSpec:
    with open(TEMPLATES_DIR / f"{template_id}.json") as f:
        data = json.load(f)
    return LayoutSpec(**data["layout"])


def test_mx_cutout_is_14mm():
    """Cherry MX spec: switch cutout must be 14.0mm square."""
    assert MX_CUTOUT_MM == 14.0


def test_65_percent_plate_dimensions():
    layout = _load_layout("65_percent")
    bounds = get_plate_bounds(layout)
    # 65% is roughly 16.25u wide x 5u tall
    # At 19.05mm pitch + 7.5mm margin each side = ~324.6 x 110.2mm
    assert 320 < bounds["width_mm"] < 330
    assert 105 < bounds["height_mm"] < 115


def test_cutout_dimensions_exact():
    """First cutout in a generated DXF must be exactly 14.0mm x 14.0mm."""
    layout = _load_layout("60_percent")
    doc = generate_plate_dxf(layout, PlateConfig())
    msp = doc.modelspace()
    cutouts = [e for e in msp if e.dxf.layer == "Cutouts"]
    assert len(cutouts) > 0

    pts = list(cutouts[0].get_points())
    dx = abs(pts[1][0] - pts[0][0])
    dy = abs(pts[2][1] - pts[1][1])
    assert abs(dx - 14.0) < 0.001, f"Cutout width: {dx}"
    assert abs(dy - 14.0) < 0.001, f"Cutout height: {dy}"


def test_plate_has_mounting_holes():
    layout = _load_layout("65_percent")
    doc = generate_plate_dxf(layout, PlateConfig())
    msp = doc.modelspace()
    holes = [e for e in msp if e.dxf.layer == "MountingHoles"]
    assert len(holes) == 5  # 4 corners + 1 center


def test_plate_has_stabilizer_cutouts():
    """65% has Backspace, Enter, LShift, RShift, Spacebar = 5 stab keys = 10 cutouts."""
    layout = _load_layout("65_percent")
    stab_keys = [k for k in layout.keys if k.stabilizer != "none"]
    assert len(stab_keys) >= 4  # At least Bksp, Enter, LShift, Space

    doc = generate_plate_dxf(layout, PlateConfig())
    msp = doc.modelspace()
    cutouts = [e for e in msp if e.dxf.layer == "Cutouts"]
    # Total cutouts = keys + (stab_keys * 2 cutouts each)
    assert len(cutouts) == len(layout.keys) + len(stab_keys) * 2


def test_plate_dxf_saves_to_file():
    layout = _load_layout("60_percent")
    with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as f:
        path = f.name
    generate_plate_dxf(layout, PlateConfig(), output_path=path)
    assert Path(path).exists()
    assert Path(path).stat().st_size > 0


def test_kerf_compensation():
    """Kerf compensation should make cutouts larger."""
    layout = LayoutSpec(keys=[KeySpec(id="k1", x_u=0, y_u=0, w_u=1, h_u=1)])

    doc_no_kerf = generate_plate_dxf(layout, PlateConfig(kerf_compensation_mm=0))
    doc_kerf = generate_plate_dxf(layout, PlateConfig(kerf_compensation_mm=0.2))

    # Filter to Cutouts layer only
    cutouts_no = [e for e in doc_no_kerf.modelspace() if e.dxf.layer == "Cutouts"]
    cutouts_k = [e for e in doc_kerf.modelspace() if e.dxf.layer == "Cutouts"]
    assert len(cutouts_no) > 0 and len(cutouts_k) > 0

    pts_no = list(cutouts_no[0].get_points())
    pts_k = list(cutouts_k[0].get_points())

    w_no = abs(pts_no[1][0] - pts_no[0][0])
    w_kerf = abs(pts_k[1][0] - pts_k[0][0])
    assert w_kerf > w_no, "Kerf compensation should enlarge cutouts"
    assert abs(w_kerf - w_no - 0.2) < 0.001


def test_bounds_match_between_dxf_and_metadata():
    """get_plate_bounds must agree with the DXF outline."""
    layout = _load_layout("65_percent")
    config = PlateConfig()
    bounds = get_plate_bounds(layout, config)
    doc = generate_plate_dxf(layout, config)
    msp = doc.modelspace()
    outlines = [e for e in msp if e.dxf.layer == "Outline"]
    assert len(outlines) == 1
    pts = list(outlines[0].get_points())
    dxf_w = abs(pts[1][0] - pts[0][0])
    dxf_h = abs(pts[2][1] - pts[1][1])
    assert abs(dxf_w - bounds["width_mm"]) < 0.1
    assert abs(dxf_h - bounds["height_mm"]) < 0.1
