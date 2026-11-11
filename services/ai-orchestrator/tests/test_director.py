import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ai_orchestrator.registry import MODEL_REGISTRY  # noqa: E402


def test_registry_records_licence_for_every_model() -> None:
    assert MODEL_REGISTRY
    for record in MODEL_REGISTRY:
        assert record.licence, f"{record.id} has no licence recorded"
        assert record.commercial_use in {"allowed", "restricted", "unknown", "forbidden"}


def test_restricted_models_are_not_marked_available() -> None:
    for record in MODEL_REGISTRY:
        if record.commercial_use == "restricted":
            assert record.status != "available", f"{record.id} is restricted but enabled"


def test_blender_version_is_pinned_to_an_lts() -> None:
    blender = next(r for r in MODEL_REGISTRY if r.id == "blender")
    assert "LTS" in blender.version
