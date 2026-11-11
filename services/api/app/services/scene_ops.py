"""Server-side scene operations.

Mirrors packages/editor/src/operations.ts. The API applies plans here so a
client cannot smuggle an unvalidated change into storage; the same document is
then handed to the Blender builder.
"""

from __future__ import annotations

import uuid
from copy import deepcopy
from datetime import UTC, datetime
from typing import Any


class OperationError(Exception):
    pass


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def _find(scene: dict[str, Any], object_id: str) -> dict[str, Any]:
    for obj in scene["objects"]:
        if obj["id"] == object_id:
            return obj
    raise OperationError(f"object {object_id} not found")


def _bump(obj: dict[str, Any]) -> None:
    obj["version"] = int(obj.get("version", 1)) + 1


def apply_operations(scene: dict[str, Any], operations: list[dict[str, Any]]) -> tuple[dict[str, Any], list[str]]:
    """Apply operations atomically to a copy of the scene."""
    working = deepcopy(scene)
    touched: list[str] = []

    for op in operations:
        name = op.get("op")
        params = op.get("params") or {}
        target_id = op.get("target_id")

        if name == "set_transform":
            obj = _find(working, target_id)
            transform = obj["transform"]
            for key in ("position", "rotation", "scale"):
                if key in params:
                    transform[key] = list(params[key])
            _bump(obj)
            touched.append(obj["id"])
        elif name == "set_material":
            obj = _find(working, target_id)
            obj["material_overrides"] = {**(obj.get("material_overrides") or {}), **params.get("patch", {})}
            _bump(obj)
            touched.append(obj["id"])
        elif name == "set_geometry_param":
            obj = _find(working, target_id)
            if obj["geometry"].get("kind") == "primitive":
                obj["geometry"]["params"][params["param"]] = params["value"]
                _bump(obj)
                touched.append(obj["id"])
        elif name == "replace_geometry":
            obj = _find(working, target_id)
            obj["geometry"] = params["geometry"]
            _bump(obj)
            touched.append(obj["id"])
        elif name == "set_visibility":
            obj = _find(working, target_id)
            obj["visible"] = bool(params["visible"])
            _bump(obj)
            touched.append(obj["id"])
        elif name == "set_locked":
            obj = _find(working, target_id)
            obj["locked"] = bool(params["locked"])
            _bump(obj)
            touched.append(obj["id"])
        elif name == "rename":
            obj = _find(working, target_id)
            obj["name"] = params["name"]
            _bump(obj)
            touched.append(obj["id"])
        elif name == "reparent":
            obj = _find(working, target_id)
            obj["parent_id"] = params.get("parent_id")
            _bump(obj)
            touched.append(obj["id"])
        elif name == "add_object":
            spec = params["object"]
            new_obj = {
                "id": _new_id("obj"),
                "name": spec["name"],
                "type": spec["type"],
                "parent_id": params.get("parent_id"),
                "transform": {
                    "position": list((spec.get("transform") or {}).get("position", [0, 0, 0])),
                    "rotation": list((spec.get("transform") or {}).get("rotation", [0, 0, 0])),
                    "scale": list((spec.get("transform") or {}).get("scale", [1, 1, 1])),
                },
                "geometry": spec.get("geometry") or {"kind": "none"},
                "material_id": spec.get("material_id"),
                "material_overrides": None,
                "texture_refs": [],
                "animation_refs": [],
                "visible": True,
                "locked": False,
                "protected": False,
                "tags": spec.get("tags", []),
                "version": 1,
                "metadata": {"created_by": "ai_plan"},
            }
            working["objects"].append(new_obj)
            touched.append(new_obj["id"])
        elif name == "remove_object":
            doomed = {target_id}
            grew = True
            while grew:
                grew = False
                for obj in working["objects"]:
                    if obj.get("parent_id") in doomed and obj["id"] not in doomed:
                        doomed.add(obj["id"])
                        grew = True
            working["objects"] = [o for o in working["objects"] if o["id"] not in doomed]
            working["animations"] = [a for a in working["animations"] if a["target_id"] not in doomed]
            for shot in working["shots"]:
                shot["subjects"] = [s for s in shot.get("subjects", []) if s not in doomed]
            if working.get("active_camera_id") in doomed:
                working["active_camera_id"] = None
            touched.extend(sorted(doomed))
        elif name == "set_character":
            obj = _find(working, target_id)
            if not obj.get("character"):
                raise OperationError(f"{obj['name']} is not a character")
            character = obj["character"]
            patch = params.get("patch", {})
            if "hair" in patch:
                character["hair"] = {**character["hair"], **patch["hair"]}
            if "wardrobe" in patch:
                character["wardrobe"] = patch["wardrobe"]
            if "expression" in patch:
                character["expression"] = {**character.get("expression", {}), **patch["expression"]}
            if "pose" in patch:
                character["pose"] = {**character["pose"], **patch["pose"]}
            if "proportions" in patch:
                character["proportions"] = {**character["proportions"], **patch["proportions"]}
            if "age_band" in patch:
                character["age_band"] = patch["age_band"]
            _bump(obj)
            touched.append(obj["id"])
        elif name == "set_camera":
            obj = _find(working, target_id)
            if not obj.get("camera"):
                raise OperationError(f"{obj['name']} is not a camera")
            obj["camera"] = {**obj["camera"], **params.get("patch", {})}
            _bump(obj)
            touched.append(obj["id"])
        elif name == "set_light":
            obj = _find(working, target_id)
            if not obj.get("light"):
                raise OperationError(f"{obj['name']} is not a light")
            obj["light"] = {**obj["light"], **params.get("patch", {})}
            _bump(obj)
            touched.append(obj["id"])
        elif name == "set_environment":
            working["environment"] = {**working["environment"], **params.get("patch", {})}
        elif name == "set_global_style":
            working["environment"]["global_style"] = params["style"]
            if params.get("color_management"):
                working["settings"]["color_management"] = {
                    **working["settings"]["color_management"],
                    **params["color_management"],
                }
        elif name == "add_animation":
            spec = params["clip"]
            clip = {
                "id": _new_id("anim"),
                "name": spec["name"],
                "target_id": target_id,
                "kind": spec["kind"],
                "start_frame": spec["start_frame"],
                "end_frame": spec["end_frame"],
                "loop": spec.get("loop", False),
                "source": spec.get("source") or {"kind": "manual", "model_id": None},
                "tracks": [
                    {
                        "id": _new_id("trk"),
                        "channel": track["channel"],
                        "keyframes": [{**kf, "id": _new_id("kf")} for kf in track.get("keyframes", [])],
                    }
                    for track in spec.get("tracks", [])
                ],
            }
            working["animations"].append(clip)
            obj = _find(working, target_id)
            obj["animation_refs"] = sorted(set([*obj.get("animation_refs", []), clip["id"]]))
            _bump(obj)
            touched.append(obj["id"])
        elif name == "add_keyframe":
            clip = next((a for a in working["animations"] if a["id"] == params["clip_id"]), None)
            if clip is None:
                raise OperationError(f'clip {params["clip_id"]} not found')
            track = next((t for t in clip["tracks"] if t["channel"] == params["channel"]), None)
            if track is None:
                track = {"id": _new_id("trk"), "channel": params["channel"], "keyframes": []}
                clip["tracks"].append(track)
            track["keyframes"] = [k for k in track["keyframes"] if k["frame"] != params["frame"]]
            track["keyframes"].append(
                {
                    "id": _new_id("kf"),
                    "frame": params["frame"],
                    "value": params["value"],
                    "interpolation": params.get("interpolation", "bezier"),
                }
            )
            track["keyframes"].sort(key=lambda k: k["frame"])
            touched.append(target_id)
        elif name == "set_shot":
            shot = params["shot"]
            existing = next((s for s in working["shots"] if s["id"] == shot["id"]), None)
            if existing:
                working["shots"] = [shot if s["id"] == shot["id"] else s for s in working["shots"]]
            else:
                working["shots"].append(shot)
            working["shots"].sort(key=lambda s: s["start_frame"])
            for index, item in enumerate(working["shots"]):
                item["index"] = index
        else:
            raise OperationError(f"unsupported operation {name}")

    working["revision"] = int(scene.get("revision", 0)) + 1
    working["updated_at"] = datetime.now(UTC).isoformat()
    return working, sorted(set(touched))


def validate_scene_shape(scene: dict[str, Any], max_objects: int = 5000) -> list[str]:
    """Cheap structural checks that must hold for anything we store or render."""
    problems: list[str] = []
    objects = scene.get("objects")
    if not isinstance(objects, list):
        return ["objects must be a list"]
    if len(objects) > max_objects:
        problems.append(f"scene has {len(objects)} objects, limit is {max_objects}")

    ids = [o.get("id") for o in objects]
    if len(ids) != len(set(ids)):
        problems.append("duplicate object ids")
    id_set = set(ids)
    for obj in objects:
        parent = obj.get("parent_id")
        if parent is not None and parent not in id_set:
            problems.append(f'{obj.get("name")} references missing parent {parent}')
        if obj.get("type") == "camera" and not obj.get("camera"):
            problems.append(f'{obj.get("name")} is a camera without settings')
        if obj.get("type") == "light" and not obj.get("light"):
            problems.append(f'{obj.get("name")} is a light without settings')
    active = scene.get("active_camera_id")
    if active and active not in id_set:
        problems.append(f"active camera {active} does not exist")
    return problems
