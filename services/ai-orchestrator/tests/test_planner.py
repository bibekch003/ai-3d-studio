import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ai_orchestrator import plan_edit, plan_scene  # noqa: E402
from ai_orchestrator.adapters import adapter_status, get_adapter  # noqa: E402
from ai_orchestrator.planner import validate_plan  # noqa: E402

import json  # noqa: E402

FIXTURE = Path(__file__).resolve().parents[3] / "services" / "api" / "app" / "scene_fixtures.py"


def load_scene() -> dict:
    sys.path.insert(0, str(FIXTURE.parents[1]))
    from app.scene_fixtures import demo_scene

    return demo_scene()


SCENE = load_scene()


def test_material_instruction_targets_the_table() -> None:
    plan = plan_edit("Make the table look like old oak wood.", SCENE)
    ops = [op for op in plan["operations"] if op["op"] == "set_material"]
    assert ops and ops[0]["target_id"] == "obj_table"
    assert validate_plan(plan, SCENE)["ok"] is True


def test_preservation_blocks_identity_changes() -> None:
    plan = plan_edit("Change his hairstyle but preserve his identity.", SCENE)
    assert not any(op["op"] == "set_character" for op in plan["operations"])
    assert "identity" in plan["preserve"]["properties"]


def test_face_preserved_but_hair_allowed() -> None:
    plan = plan_edit("Give him a buzz cut but preserve his face.", SCENE)
    assert any(op["op"] == "set_character" for op in plan["operations"])
    assert validate_plan(plan, SCENE)["ok"] is True


def test_lighting_plan_touches_every_light() -> None:
    plan = plan_edit("Change the lighting to a sunset atmosphere.", SCENE)
    light_ops = [op for op in plan["operations"] if op["op"] == "set_light"]
    assert len(light_ops) == 3
    assert any(op["op"] == "set_environment" for op in plan["operations"])


def test_unmappable_prompt_is_honest() -> None:
    plan = plan_edit("zzzz qqqq", SCENE)
    assert plan["operations"] == []
    assert plan["confidence"] < 0.5
    assert plan["requires_confirmation"] is True


def test_validator_rejects_type_mismatch() -> None:
    plan = {
        "id": "p",
        "prompt": "x",
        "operations": [{"op": "set_camera", "target_id": "obj_apple", "params": {"patch": {"fstop": 1}}}],
        "preserve": {"properties": [], "object_ids": []},
        "confidence": 0.9,
    }
    result = validate_plan(plan, SCENE)
    assert result["ok"] is False
    assert any(e["code"] == "plan.target_type_mismatch" for e in result["errors"])


def test_validator_blocks_ai_created_cameras() -> None:
    plan = {
        "id": "p",
        "prompt": "x",
        "operations": [{"op": "add_object", "target_id": None, "params": {"object": {"name": "cam", "type": "camera"}, "parent_id": None}}],
        "preserve": {"properties": [], "object_ids": []},
        "confidence": 0.9,
    }
    assert any(e["code"] == "plan.add_object_type_blocked" for e in validate_plan(plan, SCENE)["errors"])


def test_plan_is_json_serialisable() -> None:
    plan = plan_edit("Make the apple glossy red.", SCENE)
    json.dumps(plan)  # must not raise


def test_director_builds_ordered_shots() -> None:
    plan = plan_scene("A boy enters a room, walks towards a wooden table, picks up a red apple and takes a bite.")
    assert plan["characters"][0]["name"] == "Boy"
    assert plan["props"][0]["name"] == "Apple"
    assert plan["shots"][0]["name"] == "Establishing"
    for previous, current in zip(plan["shots"], plan["shots"][1:]):
        assert current["start_frame"] == previous["end_frame"]
    assert "exec" not in json.dumps(plan["operations"])


def test_director_warns_when_no_character_named() -> None:
    plan = plan_scene("A camera pushes through an empty corridor.")
    assert any("No character" in w for w in plan["warnings"])


def test_unconfigured_adapters_never_fake_success() -> None:
    for status in adapter_status():
        if not status["configured"]:
            result = get_adapter(status["task"]).generate({"prompt": "test"})
            assert result.ok is False
            assert result.payload == {}
