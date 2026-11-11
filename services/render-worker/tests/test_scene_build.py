import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "api"))

from app.scene_fixtures import demo_scene  # noqa: E402
from render_worker.scene_build import build_plan, hex_to_linear_rgb  # noqa: E402


def test_build_plan_maps_every_object_type() -> None:
    plan = build_plan(demo_scene())
    assert plan.object_count == len(demo_scene()["objects"])
    assert len(plan.cameras) == 1
    assert len(plan.lights) == 3
    assert any(mesh["primitive"] == "sphere" for mesh in plan.meshes)
    assert any(empty["kind"] == "procedural" for empty in plan.empties)


def test_blender_objects_are_named_by_object_id() -> None:
    plan = build_plan(demo_scene())
    names = {m["name"] for m in plan.meshes} | {c["name"] for c in plan.cameras} | {l["name"] for l in plan.lights}
    assert "obj_apple" in names
    assert "cam_main" in names
    assert "lgt_key" in names


def test_active_camera_and_parenting_survive() -> None:
    scene = demo_scene()
    plan = build_plan(scene)
    assert [c["active"] for c in plan.cameras] == [True]
    assert ("chr_boy_head", "chr_boy") in plan.parents


def test_render_settings_are_carried_over() -> None:
    plan = build_plan(demo_scene())
    assert plan.render["engine"] == "eevee"
    assert plan.render["resolution"] == {"width": 1920, "height": 1080}
    assert plan.render["frame_end"] == 240
    assert plan.render["view_transform"] == "AgX"


def test_colour_conversion_is_linear_not_srgb() -> None:
    r, g, b, a = hex_to_linear_rgb("#ffffff")
    assert (r, g, b, a) == (1.0, 1.0, 1.0, 1.0)
    dark = hex_to_linear_rgb("#808080")[0]
    assert 0.2 < dark < 0.25  # sRGB 0.5 -> linear ~0.216


def test_animations_are_exported_with_keyframes() -> None:
    plan = build_plan(demo_scene())
    assert plan.animations
    clip = plan.animations[0]
    assert clip["target_id"] == "chr_boy"
    assert len(clip["tracks"][0]["keyframes"]) == 2


def test_unimplemented_assets_are_reported_not_silently_dropped() -> None:
    plan = build_plan(demo_scene())
    assert any("asset" in warning for warning in plan.warnings)
    assert any("procedural" in warning for warning in plan.warnings)
