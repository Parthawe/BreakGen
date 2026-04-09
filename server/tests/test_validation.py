"""Tests for the validation engine."""

from server.models.project import KeyboardProject, KeySpec, LayoutSpec, StabilizerType
from server.models.validation_schema import CheckStatus
from server.validation.engine import validate_project


def _project_with_keys(keys: list[KeySpec]) -> KeyboardProject:
    return KeyboardProject(
        project_id="test",
        layout=LayoutSpec(keys=keys),
    )


def test_empty_layout_fails():
    report = validate_project(_project_with_keys([]))
    assert report.status == CheckStatus.FAIL
    empty_check = next(c for c in report.checks if c.id == "layout_nonempty")
    assert empty_check.status == CheckStatus.FAIL


def test_valid_project_passes():
    p = KeyboardProject(
        project_id="test",
        layout=LayoutSpec(keys=[
            KeySpec(id="k1", x_u=0, y_u=0, w_u=1, h_u=1, label="A"),
        ]),
    )
    p.switch_profile.part_id = "cherry_mx_red"
    report = validate_project(p)
    # Should not fail (may warn)
    assert report.status in (CheckStatus.PASS, CheckStatus.WARN)


def test_wide_key_missing_stab_warns():
    p = _project_with_keys([
        KeySpec(id="k1", x_u=0, y_u=0, w_u=2.25, h_u=1, label="Shift", stabilizer=StabilizerType.NONE),
    ])
    report = validate_project(p)
    stab_check = next(c for c in report.checks if c.id == "stabilizer_assignment")
    assert stab_check.status == CheckStatus.WARN


def test_wide_key_with_stab_passes():
    p = _project_with_keys([
        KeySpec(id="k1", x_u=0, y_u=0, w_u=2.25, h_u=1, label="Shift", stabilizer=StabilizerType.CHERRY),
    ])
    report = validate_project(p)
    stab_check = next(c for c in report.checks if c.id == "stabilizer_assignment")
    assert stab_check.status == CheckStatus.PASS


def test_overlapping_keys_warns():
    p = _project_with_keys([
        KeySpec(id="k1", x_u=0, y_u=0, w_u=1, h_u=1, label="A"),
        KeySpec(id="k2", x_u=0.5, y_u=0, w_u=1, h_u=1, label="B"),
    ])
    report = validate_project(p)
    overlap = next(c for c in report.checks if c.id == "key_overlap")
    assert overlap.status == CheckStatus.WARN


def test_no_switch_selected_warns():
    p = _project_with_keys([
        KeySpec(id="k1", x_u=0, y_u=0, w_u=1, h_u=1, label="A"),
    ])
    report = validate_project(p)
    sw = next(c for c in report.checks if c.id == "switch_selected")
    assert sw.status == CheckStatus.WARN


def test_matrix_feasibility_passes_small_layout():
    p = _project_with_keys([
        KeySpec(id=f"k{i}", x_u=i, y_u=0, w_u=1, h_u=1, label=str(i))
        for i in range(10)
    ])
    report = validate_project(p)
    mx = next(c for c in report.checks if c.id == "matrix_feasibility")
    assert mx.status == CheckStatus.PASS
