"""Deterministic natural-language edit planner (server authoritative).

Mirrors packages/scene-core/src/planner.ts. The rule table is the product
behaviour: every rule resolves real object ids from the scene graph and emits a
structured operation. Nothing here executes code, calls a network, or invents
object ids.

An LLM adapter may replace this planner, but it must return the same EditPlan
shape, and the API still validates the plan against the live scene before any
operation is applied.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Iterable

MATERIAL_PRESETS: dict[str, dict[str, Any]] = {
    "oak": {"name": "Old oak", "base_color": "#7a5230", "roughness": 0.72, "metallic": 0.0},
    "walnut": {"name": "Walnut", "base_color": "#4b2f1c", "roughness": 0.55, "metallic": 0.0},
    "pine": {"name": "Pine", "base_color": "#c39a6b", "roughness": 0.8, "metallic": 0.0},
    "marble": {"name": "Carrara marble", "base_color": "#e8e6e1", "roughness": 0.18, "metallic": 0.0},
    "concrete": {"name": "Concrete", "base_color": "#9a9a96", "roughness": 0.92, "metallic": 0.0},
    "metal": {"name": "Brushed metal", "base_color": "#b8bcc0", "roughness": 0.28, "metallic": 1.0},
    "brass": {"name": "Aged brass", "base_color": "#b08d57", "roughness": 0.35, "metallic": 1.0},
    "glass": {"name": "Clear glass", "base_color": "#dfe9ee", "roughness": 0.05, "metallic": 0.0, "opacity": 0.25},
    "linen": {"name": "Linen", "base_color": "#d8cfc0", "roughness": 0.95, "metallic": 0.0},
    "leather": {"name": "Worn leather", "base_color": "#5b3a2a", "roughness": 0.6, "metallic": 0.0},
    "ceramic": {"name": "Glazed ceramic", "base_color": "#e4e0d6", "roughness": 0.12, "metallic": 0.0},
    "neon": {"name": "Neon", "base_color": "#22d3ee", "roughness": 0.4, "metallic": 0.0, "emissive": "#22d3ee"},
}

NAMED_COLORS = {
    "red": "#a41f1f",
    "green": "#2f6b3a",
    "blue": "#2f4a72",
    "navy": "#1d2b45",
    "black": "#141414",
    "white": "#f2f0ec",
    "grey": "#8a8a8a",
    "gray": "#8a8a8a",
    "gold": "#b08d57",
    "silver": "#c0c4c8",
    "brown": "#6b4a2f",
}

HAIR_PRESETS = {
    "short": "hair.short_crop",
    "buzz": "hair.buzz",
    "long": "hair.long_wave",
    "curly": "hair.curly_medium",
    "bald": "hair.none",
    "bun": "hair.bun",
    "ponytail": "hair.ponytail",
    "tousled": "hair.short_tousled",
}

ENVIRONMENT_PRESETS = {
    "laboratory": ("room.lab.futuristic", "interior"),
    "lab": ("room.lab.futuristic", "interior"),
    "forest": ("landscape.forest.temperate", "exterior"),
    "street": ("urban.street.narrow", "exterior"),
    "city": ("urban.city.downtown", "exterior"),
    "beach": ("landscape.beach.tropical", "exterior"),
    "desert": ("landscape.desert.dunes", "exterior"),
    "room": ("room.domestic.small", "interior"),
    "kitchen": ("room.kitchen.modern", "interior"),
    "office": ("room.office.open", "interior"),
    "studio": ("studio.cyc.infinity", "studio"),
}

STYLE_WORDS = [
    ("cinematic", ["cinematic", "film look"]),
    ("photoreal", ["photoreal", "photorealistic", "realistic"]),
    ("anime", ["anime", "manga"]),
    ("noir", ["noir", "black and white", "monochrome"]),
    ("clay_render", ["clay", "claymation"]),
    ("low_poly", ["low poly", "lowpoly"]),
    ("stylised", ["stylised", "stylized", "cartoon"]),
]

EXPRESSIONS = [
    ("smile", ["smile", "smiling", "happy", "grin"], {"mouth_smile": 1.0, "cheek_raise": 0.4}),
    ("frown", ["frown", "sad", "unhappy"], {"mouth_smile": 0.0, "mouth_frown": 0.8}),
    ("angry", ["angry", "furious", "mad"], {"brow_down": 0.9, "mouth_press": 0.6}),
    ("surprised", ["surprised", "shocked", "amazed"], {"brow_up": 0.9, "jaw_open": 0.5}),
    ("neutral", ["neutral", "expressionless"], {"mouth_smile": 0.1, "brow_neutral": 1.0}),
]

ACTION_CLIPS = [
    ("walk", ["walk", "walks", "walking"], 48, "transform"),
    ("run", ["run", "runs", "running"], 36, "transform"),
    ("pickup", ["pick up", "picks up", "picking up", "grab", "grabs"], 36, "pose"),
    ("putdown", ["put down", "puts down", "putting down"], 36, "pose"),
    ("open", ["open", "opens", "opening"], 30, "pose"),
    ("close", ["close", "closes", "closing"], 30, "pose"),
    ("sit", ["sit", "sits", "sitting"], 42, "pose"),
    ("turn", ["turn", "turns", "turning", "look at"], 24, "pose"),
    ("wave", ["wave", "waves", "waving", "gesture"], 36, "pose"),
]

PRESERVATION_PATTERNS = [
    (r"\b(preserve|keep|maintain|without changing|don't change|do not change)\b[^.]*\bface\b", "face"),
    (r"\b(preserve|keep|maintain)\b[^.]*\b(hair|hairstyle)\b", "hair"),
    (r"\b(preserve|keep|maintain)\b[^.]*\b(identity|same person|recognisable|recognizable)\b", "identity"),
    (r"\b(preserve|keep|maintain)\b[^.]*\bmaterial", "materials"),
    (r"\b(preserve|keep|maintain)\b[^.]*\b(position|placement)\b", "transform"),
    (r"\b(preserve|keep|maintain)\b[^.]*\b(animation|motion)\b", "animation"),
    (r"\b(preserve|keep|maintain)\b[^.]*\bcamera\b", "camera"),
    (r"\b(preserve|keep|maintain)\b[^.]*\blight", "lighting"),
]

CREATABLE_TYPES = {"prop", "furniture", "plant", "vehicle", "building", "group", "particles", "audio", "environment", "body_part"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def _normalise(text: str) -> str:
    return re.sub(r"[\s_-]+", " ", text.lower()).strip()


def search_objects(scene: dict[str, Any], query: str, limit: int = 8) -> list[tuple[dict[str, Any], float]]:
    """Name/tag search over the scene graph. Deterministic and explainable."""
    q = _normalise(query)
    if not q:
        return []
    words = [w for w in q.split() if len(w) > 1]
    results: list[tuple[dict[str, Any], float]] = []
    for obj in scene.get("objects", []):
        name = _normalise(obj.get("name", ""))
        tags = [_normalise(t) for t in obj.get("tags", [])]
        score = 0.0
        if name == q:
            score = 1.0
        elif q in name:
            score = 0.85
        elif name and name in q:
            score = 0.7
        else:
            hits = [w for w in words if w in name or any(w in t for t in tags)]
            if hits:
                score = 0.35 + 0.4 * (len(hits) / max(1, len(words)))
            elif any(t in q for t in tags):
                score = 0.4
        if obj.get("type") in {"group", "environment"}:
            score -= 0.1
        if score > 0:
            results.append((obj, max(0.05, min(1.0, score))))
    results.sort(key=lambda pair: pair[1], reverse=True)
    return results[:limit]


def _resolve(scene: dict[str, Any], query: str) -> tuple[dict[str, Any] | None, float]:
    matches = search_objects(scene, query, 1)
    if not matches:
        return None, 0.0
    return matches[0]


def _first_of_type(scene: dict[str, Any], obj_type: str) -> dict[str, Any] | None:
    for obj in scene.get("objects", []):
        if obj.get("type") == obj_type:
            return obj
    return None


def _ancestors(scene: dict[str, Any], obj: dict[str, Any]) -> Iterable[dict[str, Any]]:
    by_id = {o["id"]: o for o in scene.get("objects", [])}
    cursor = obj.get("parent_id")
    seen: set[str] = set()
    while cursor and cursor in by_id and cursor not in seen:
        seen.add(cursor)
        parent = by_id[cursor]
        yield parent
        cursor = parent.get("parent_id")


def _noun_after(lower: str, verbs: list[str]) -> str | None:
    for verb in verbs:
        pattern = rf"{verb}\s+(?:the\s+|a\s+|an\s+|his\s+|her\s+|their\s+|my\s+)?([a-z0-9 _-]{{2,40}})"
        match = re.search(pattern, lower)
        if match:
            return re.split(r"\s+(?:to|so|and|with|but|look|into)\b", match.group(1).strip())[0].strip()
    return None


def plan_edit(prompt: str, scene: dict[str, Any], scope: list[str] | None = None) -> dict[str, Any]:
    """Turn an instruction into a validated-ready EditPlan document."""
    lower = prompt.lower().strip()
    operations: list[dict[str, Any]] = []
    targets: dict[str, dict[str, Any]] = {}
    warnings: list[str] = []
    scores: list[float] = []

    preserve = {"properties": [], "object_ids": []}
    for pattern, prop in PRESERVATION_PATTERNS:
        if re.search(pattern, lower):
            preserve["properties"].append(prop)

    def add_target(obj: dict[str, Any], reason: str, confidence: float) -> None:
        targets.setdefault(
            obj["id"],
            {
                "object_id": obj["id"],
                "name": obj["name"],
                "type": obj["type"],
                "reason": reason,
                "confidence": round(confidence, 2),
            },
        )
        scores.append(confidence)

    scoped = scene
    if scope:
        scoped = {**scene, "objects": [o for o in scene.get("objects", []) if o["id"] in scope]}

    # --- hairstyle -----------------------------------------------------------
    if re.search(r"\b(hair|hairstyle|haircut|buzz cut|trim)\b", lower):
        explicit = next((k for k in HAIR_PRESETS if k in lower), None)
        hair_obj, hair_score = _resolve(scoped, "hair")
        character = None
        if hair_obj is not None:
            if hair_obj.get("type") == "character":
                character = hair_obj
            else:
                character = next((a for a in _ancestors(scene, hair_obj) if a.get("type") == "character"), None)
        if character is None:
            character = _first_of_type(scene, "character")
        if character and character.get("character"):
            style = HAIR_PRESETS.get(explicit or "tousled", "hair.short_tousled")
            operations.append(
                {"op": "set_character", "target_id": character["id"], "params": {"patch": {"hair": {"style_id": style}}}}
            )
            add_target(character, "named in prompt (hair)", hair_score or 0.6)

    # --- expression ----------------------------------------------------------
    for name, words, weights in EXPRESSIONS:
        if any(w in lower for w in words) and re.search(r"\b(face|expression|smile|frown|angry|surprised|look)\b", lower):
            character = _first_of_type(scene, "character")
            if character and character.get("character"):
                operations.append(
                    {"op": "set_character", "target_id": character["id"], "params": {"patch": {"expression": weights}}}
                )
                add_target(character, f'expression "{name}"', 0.8)
            break

    # --- materials -----------------------------------------------------------
    material_key = next((k for k in MATERIAL_PRESETS if k in lower), None)
    colour_key = next((c for c in NAMED_COLORS if re.search(rf"\b{c}\b", lower)), None)
    surface = re.search(r"\b(material|texture|surface|look like|glossy|shiny|matte|polished|rough|metallic)\b", lower)
    if material_key or surface or colour_key:
        noun = _noun_after(lower, ["make", "change", "replace", "turn"])
        target = None
        if noun:
            target, t_score = _resolve(scoped, noun)
        else:
            t_score = 0.0
        target = target or _first_of_type(scene, "furniture") or _first_of_type(scene, "prop")
        if target is not None:
            patch = dict(MATERIAL_PRESETS[material_key]) if material_key else {
                "name": "AI material",
                "base_color": NAMED_COLORS.get(colour_key or "", "#8a8a8a"),
                "roughness": 0.15 if re.search(r"shiny|glossy|polished", lower) else 0.7,
                "metallic": 1.0 if re.search(r"metal|steel|chrome|brass", lower) else 0.0,
            }
            operations.append({"op": "set_material", "target_id": target["id"], "params": {"patch": patch}})
            add_target(target, f'material "{material_key or "custom"}"', t_score or 0.55)

    # --- replace A with B ----------------------------------------------------
    replace_match = re.search(
        r"replace\s+(?:the\s+|his\s+|her\s+)?([a-z0-9 _-]{2,30})\s+with\s+(?:a\s+|an\s+|the\s+)?([a-z0-9 _-]{2,40})", lower
    )
    if replace_match:
        target, t_score = _resolve(scoped, replace_match.group(1))
        replacement = replace_match.group(2).strip()
        if target is not None:
            generator = "prop." + re.sub(r"[^a-z0-9]+", "_", replacement)
            operations.append(
                {
                    "op": "replace_geometry",
                    "target_id": target["id"],
                    "params": {"geometry": {"kind": "procedural", "generator": generator, "params": {"variant": replacement}}},
                }
            )
            operations.append({"op": "rename", "target_id": target["id"], "params": {"name": replacement.title()}})
            add_target(target, f'replaced with "{replacement}"', t_score)
            warnings.append(f'Generator "{generator}" must exist in the asset library; otherwise the silhouette is unchanged.')

    # --- lighting ------------------------------------------------------------
    if re.search(r"\b(light|lighting|lit|sunset|sunrise|golden hour|night|dusk|moody|dramatic)\b", lower):
        lights = [o for o in scene.get("objects", []) if o.get("type") == "light"]
        night = bool(re.search(r"\bnight|moonlit\b", lower))
        sunset = bool(re.search(r"\b(sunset|golden hour|warm)\b", lower))
        dramatic = bool(re.search(r"\b(dramatic|moody|contrast|noir)\b", lower))
        for light in lights:
            role = (light.get("light") or {}).get("role")
            patch: dict[str, Any] = {}
            if role == "key":
                patch["color"] = "#8fa8ff" if night else "#ffb066" if sunset else "#ffe9c9"
                patch["intensity_watts"] = 40 if night else 180 if sunset else 220
                if dramatic:
                    patch["softness"] = 0.15
            elif role == "fill":
                patch["intensity_watts"] = 12 if night else 50
                patch["color"] = "#5f78ff" if night else "#cfe0ff"
            elif role == "practical":
                patch["color"] = "#4a6bff" if night else "#ff9a4d" if sunset else "#fff3dd"
                patch["intensity_watts"] = 1 if night else 6 if sunset else 4
            if patch:
                operations.append({"op": "set_light", "target_id": light["id"], "params": {"patch": patch}})
                add_target(light, "lighting instruction", 0.75)
        operations.append(
            {
                "op": "set_environment",
                "target_id": None,
                "params": {
                    "patch": {
                        "time_of_day": "night" if night else "sunset" if sunset else scene["environment"]["time_of_day"],
                        "sky": {
                            **scene["environment"]["sky"],
                            "color": "#0b1224" if night else "#f4a261" if sunset else scene["environment"]["sky"]["color"],
                        },
                    }
                },
            }
        )

    # --- environment ---------------------------------------------------------
    env_key = next((k for k in ENVIRONMENT_PRESETS if re.search(rf"\b{k}\b", lower)), None)
    if env_key and re.search(r"\b(room|look like|environment|set in|background|interior|exterior)\b", lower):
        preset_id, kind = ENVIRONMENT_PRESETS[env_key]
        operations.append(
            {"op": "set_environment", "target_id": None, "params": {"patch": {"preset_id": preset_id, "kind": kind}}}
        )
        warnings.append(f'Environment preset "{preset_id}" is a set recipe; review generated dressing before final render.')

    # --- style ---------------------------------------------------------------
    for style, words in STYLE_WORDS:
        if any(w in lower for w in words):
            operations.append({"op": "set_global_style", "target_id": None, "params": {"style": style}})
            break

    # --- camera --------------------------------------------------------------
    if re.search(r"\b(camera|close[- ]up|wide shot|framing|dolly|zoom|angle|shot)\b", lower):
        camera = _first_of_type(scene, "camera")
        if camera:
            patch = {}
            if re.search(r"close[- ]?up", lower):
                patch.update({"shot_type": "close_up", "focal_length_mm": 85, "fstop": 1.8, "dof_enabled": True})
            if "wide" in lower:
                patch.update({"shot_type": "wide", "focal_length_mm": 24, "fstop": 5.6})
            if re.search(r"dolly|push in", lower):
                patch["movement"] = "dolly"
            if "handheld" in lower:
                patch["movement"] = "handheld"
            if patch:
                operations.append({"op": "set_camera", "target_id": camera["id"], "params": {"patch": patch}})
                add_target(camera, "camera instruction", 0.8)

    # --- animation -----------------------------------------------------------
    action = next((a for a in ACTION_CLIPS if any(w in lower for w in a[1])), None)
    if action and re.search(r"\b(animate|animation|make him|make her|make it|have him|have her)\b", lower):
        clip_id, _, frames, kind = action
        target = _first_of_type(scene, "character") or _first_of_type(scene, "prop")
        if target:
            channel = "transform.position" if kind == "transform" else "pose.bone.upper_arm_r.rotation"
            start_value = target["transform"]["position"] if kind == "transform" else [0, 0, 0]
            end_value = target["transform"]["position"] if kind == "transform" else [-1.1, 0.1, 0.2]
            operations.append(
                {
                    "op": "add_animation",
                    "target_id": target["id"],
                    "params": {
                        "clip": {
                            "name": f"AI {clip_id}",
                            "kind": kind,
                            "start_frame": 0,
                            "end_frame": frames,
                            "loop": False,
                            "source": {"kind": "ai", "model_id": "local.rule-engine", "prompt": prompt},
                            "tracks": [
                                {
                                    "channel": channel,
                                    "keyframes": [
                                        {"id": "kf_a", "frame": 0, "value": start_value, "interpolation": "bezier"},
                                        {"id": "kf_b", "frame": frames, "value": end_value, "interpolation": "bezier"},
                                    ],
                                }
                            ],
                        }
                    },
                }
            )
            add_target(target, f'action "{clip_id}"', 0.65)
            warnings.append(f'"{clip_id}" is a procedural placeholder clip; attach a motion-model clip for production.')

    # --- visibility / delete -------------------------------------------------
    if re.search(r"\b(hide|show|unhide)\b", lower):
        noun = _noun_after(lower, ["hide", "show", "unhide"])
        target, t_score = _resolve(scoped, noun) if noun else (None, 0.0)
        if target is not None:
            operations.append(
                {"op": "set_visibility", "target_id": target["id"], "params": {"visible": "hide" not in lower}}
            )
            add_target(target, "visibility instruction", t_score or 0.8)

    if re.search(r"\b(delete|remove)\b", lower) and not replace_match:
        noun = _noun_after(lower, ["delete", "remove"])
        target, t_score = _resolve(scoped, noun) if noun else (None, 0.0)
        if target is not None:
            operations.append({"op": "remove_object", "target_id": target["id"], "params": {}})
            add_target(target, "deletion request", t_score or 0.7)
            warnings.append("Deletion removes the object and its children from this version; undo is available.")

    # --- identity guard ------------------------------------------------------
    if "identity" in preserve["properties"] and any(op["op"] == "set_character" for op in operations):
        operations = [op for op in operations if op["op"] != "set_character"]
        warnings.append("Character appearance edit dropped because the prompt asked to preserve identity.")

    if not operations:
        warnings.append(
            "No editable change could be derived from this instruction. Name an object, a property and a verb."
        )

    confidence = 0.1 if not operations else min(0.97, 0.45 + (sum(scores) / len(scores) if scores else 0.3) * 0.5)

    return {
        "id": _new_id("plan"),
        "prompt": prompt,
        "summary": (
            "Nothing to change"
            if not operations
            else f'{len(operations)} change{"s" if len(operations) != 1 else ""} to '
            + (", ".join(t["name"] for t in targets.values()) or "the scene")
        ),
        "targets": list(targets.values()),
        "operations": operations,
        "preserve": preserve,
        "confidence": round(confidence, 2),
        "warnings": warnings,
        "requires_confirmation": confidence < 0.5
        or any(re.search(r"placeholder|must exist|dropped", w) for w in warnings),
        "producer": {"kind": "deterministic", "model_id": None},
        "estimated_cost_usd": 0.0,
        "created_at": _now(),
    }


OP_TARGET_TYPES: dict[str, list[str] | None] = {
    "set_character": ["character"],
    "set_camera": ["camera"],
    "set_light": ["light"],
    "set_environment": [],
    "set_global_style": [],
    "set_shot": [],
    "add_object": [],
}

OP_PROPERTY_MAP = {
    "set_material": "materials",
    "set_transform": "transform",
    "set_camera": "camera",
    "set_light": "lighting",
    "set_environment": "environment",
    "reparent": "hierarchy",
    "add_animation": "animation",
    "add_keyframe": "animation",
}


def preservation_conflicts(op: dict[str, Any], policy: dict[str, Any]) -> list[str]:
    keep = set(policy.get("properties", []))
    if not keep:
        return []
    if op["op"] == "set_character":
        patch = op.get("params", {}).get("patch", {})
        broken = []
        if "hair" in patch:
            if "hair" in keep:
                broken.append("hair")
            if "identity" in keep:
                broken.append("identity")
        if "expression" in patch:
            if "face" in keep:
                broken.append("face")
            if "identity" in keep:
                broken.append("identity")
        if ("proportions" in patch or "age_band" in patch or "wardrobe" in patch) and "identity" in keep:
            broken.append("identity")
        return broken
    mapped = OP_PROPERTY_MAP.get(op["op"])
    return [mapped] if mapped in keep else []


def validate_plan(plan: dict[str, Any], scene: dict[str, Any]) -> dict[str, Any]:
    """Gate every plan against the live scene before it can be applied."""
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    affected: dict[str, dict[str, Any]] = {}
    by_id = {o["id"]: o for o in scene.get("objects", [])}
    duration = scene["settings"]["duration_frames"]

    if not plan.get("operations"):
        errors.append({"code": "plan.empty", "message": "Plan contains no operations", "severity": "error"})
    if len(plan.get("operations", [])) > 200:
        errors.append({"code": "plan.too_large", "message": "Plan exceeds 200 operations", "severity": "error"})

    for i, op in enumerate(plan.get("operations", [])):
        path = f"operations.{i}"
        name = op.get("op")
        allowed = OP_TARGET_TYPES.get(name, None)
        scene_level = isinstance(allowed, list) and len(allowed) == 0

        if name == "add_object":
            spec = (op.get("params") or {}).get("object") or {}
            if not spec.get("name") or not spec.get("type"):
                errors.append({"code": "plan.add_object_invalid", "message": "add_object needs a name and type", "path": path, "severity": "error"})
            elif spec["type"] not in CREATABLE_TYPES:
                errors.append(
                    {
                        "code": "plan.add_object_type_blocked",
                        "message": f'AI plans may not create "{spec["type"]}" objects',
                        "path": path,
                        "severity": "error",
                    }
                )
            parent_id = (op.get("params") or {}).get("parent_id")
            if parent_id and parent_id not in by_id:
                errors.append({"code": "plan.parent_missing", "message": f"Parent {parent_id} does not exist", "path": path, "severity": "error"})
            affected[f"new:{i}"] = {"object_id": f"new:{i}", "name": spec.get("name", "new object"), "type": spec.get("type", "prop"), "changes": ["create"]}
        elif scene_level:
            if op.get("target_id") is not None:
                errors.append({"code": "plan.target_not_allowed", "message": f"{name} is scene-level", "path": path, "severity": "error"})
        else:
            target = by_id.get(op.get("target_id"))
            if target is None:
                errors.append(
                    {
                        "code": "plan.target_missing",
                        "message": f"{name} targets missing object {op.get('target_id')}",
                        "path": path,
                        "severity": "error",
                    }
                )
                continue
            if allowed and target["type"] not in allowed:
                errors.append(
                    {
                        "code": "plan.target_type_mismatch",
                        "message": f'{name} cannot target a {target["type"]} ({target["name"]})',
                        "path": path,
                        "severity": "error",
                    }
                )
            if target.get("locked"):
                errors.append({"code": "plan.target_locked", "message": f'"{target["name"]}" is locked', "path": path, "severity": "error"})
            if target.get("protected"):
                warnings.append(
                    {"code": "plan.target_protected", "message": f'"{target["name"]}" is protected and needs an explicit override', "path": path, "severity": "warning"}
                )
            entry = affected.setdefault(
                target["id"], {"object_id": target["id"], "name": target["name"], "type": target["type"], "changes": []}
            )
            entry["changes"].append(name)

        for prop in preservation_conflicts(op, plan.get("preserve", {})):
            errors.append(
                {
                    "code": "plan.preservation_conflict",
                    "message": f'{name} changes "{prop}" but the plan promises to preserve it',
                    "path": path,
                    "severity": "error",
                }
            )

        if name == "add_keyframe":
            frame = (op.get("params") or {}).get("frame")
            if not isinstance(frame, int) or frame < 0 or frame > duration:
                errors.append({"code": "plan.keyframe_out_of_range", "message": "Keyframe is outside the scene duration", "path": path, "severity": "error"})

        if name == "add_animation":
            clip = (op.get("params") or {}).get("clip") or {}
            if clip.get("end_frame", 0) <= clip.get("start_frame", 0):
                errors.append({"code": "plan.clip_range_invalid", "message": "Animation clip range is invalid", "path": path, "severity": "error"})

        if name == "reparent":
            target_id = op.get("target_id")
            cursor = (op.get("params") or {}).get("parent_id")
            seen: set[str] = set()
            while cursor and cursor not in seen:
                if cursor == target_id:
                    errors.append({"code": "plan.reparent_cycle", "message": "Reparenting would create a cycle", "path": path, "severity": "error"})
                    break
                seen.add(cursor)
                cursor = (by_id.get(cursor) or {}).get("parent_id")

    if plan.get("confidence", 1) < 0.5:
        warnings.append({"code": "plan.low_confidence", "message": "Planner confidence is low; confirm targets manually.", "severity": "warning"})

    return {"ok": not errors, "errors": errors, "warnings": warnings, "affected": list(affected.values())}
