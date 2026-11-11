"""Server-side demo scene, structurally identical to packages/scene-core/src/demo.ts.

Kept intentionally small: enough to exercise planning, validation, editing,
versioning and the Blender builder in tests and local development.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

MATERIALS = [
    {"id": "mat_wood_oak", "name": "Old oak", "base_color": "#7a5230", "roughness": 0.62, "metallic": 0.0},
    {"id": "mat_plaster", "name": "Plaster", "base_color": "#d9d4c8", "roughness": 0.9, "metallic": 0.0},
    {"id": "mat_apple_red", "name": "Apple skin", "base_color": "#a41f1f", "roughness": 0.28, "metallic": 0.0},
    {"id": "mat_skin", "name": "Skin", "base_color": "#c98d6b", "roughness": 0.48, "metallic": 0.0},
    {"id": "mat_hair_dark", "name": "Dark hair", "base_color": "#241a14", "roughness": 0.42, "metallic": 0.0},
    {"id": "mat_leaf", "name": "Leaf", "base_color": "#2f6b3a", "roughness": 0.7, "metallic": 0.0},
]


def _obj(
    oid: str,
    name: str,
    otype: str,
    position: tuple[float, float, float],
    *,
    parent: str | None = None,
    geometry: dict[str, Any] | None = None,
    material: str | None = None,
    tags: list[str] | None = None,
    **extra: Any,
) -> dict[str, Any]:
    obj = {
        "id": oid,
        "name": name,
        "type": otype,
        "parent_id": parent,
        "transform": {"position": list(position), "rotation": [0, 0, 0], "scale": [1, 1, 1]},
        "geometry": geometry or {"kind": "none"},
        "material_id": material,
        "material_overrides": None,
        "texture_refs": [],
        "animation_refs": [],
        "visible": True,
        "locked": False,
        "protected": False,
        "tags": tags or [],
        "version": 1,
        "metadata": {},
    }
    obj.update(extra)
    return obj


def demo_scene(scene_id: str = "scn_demo_apple", project_id: str = "prj_demo") -> dict[str, Any]:
    objects = [
        _obj("env_room", "Room", "environment", (0, 0, 0), tags=["environment", "interior"]),
        _obj(
            "obj_floor",
            "Floor",
            "building",
            (0, -0.01, 0),
            parent="env_room",
            geometry={"kind": "primitive", "primitive": "plane", "params": {"size": 1}},
            material="mat_wood_oak",
        ),
        _obj(
            "obj_wall_back",
            "Back wall",
            "building",
            (0, 1.5, -3),
            parent="env_room",
            geometry={"kind": "primitive", "primitive": "box", "params": {"size": 1}},
            material="mat_plaster",
        ),
        _obj(
            "obj_table",
            "Wooden table",
            "furniture",
            (1.2, 0.72, -1.5),
            geometry={"kind": "primitive", "primitive": "box", "params": {"width": 1.6, "height": 0.08, "depth": 0.9}},
            material="mat_wood_oak",
            tags=["table", "wood"],
        ),
        _obj(
            "obj_apple",
            "Red apple",
            "prop",
            (1.15, 0.8, -1.45),
            geometry={"kind": "primitive", "primitive": "sphere", "params": {"radius": 0.045}},
            material="mat_apple_red",
            tags=["fruit", "prop", "grab_target"],
        ),
        _obj(
            "obj_plant",
            "Potted plant",
            "plant",
            (-2.3, 0, -2.2),
            geometry={"kind": "procedural", "generator": "plant.potted", "params": {"leaves": 9}},
            material="mat_leaf",
            tags=["vegetation", "decor"],
        ),
        _obj(
            "chr_boy",
            "Character_Boy",
            "character",
            (-2.4, 0, 1.4),
            geometry={"kind": "asset", "asset_id": "asset_base_male_rig", "format": "glb"},
            material="mat_skin",
            tags=["character", "hero"],
            character={
                "identity_id": "ident_boy_01",
                "profile_id": None,
                "age_band": "adult",
                "expression": {"mouth_smile": 0.15, "brow_neutral": 1.0},
                "pose": {"rig_id": "rig_humanoid_m", "bone_rotations": {}, "bone_translations": {}, "ik_targets": {}},
                "hair": {"style_id": "hair.short_tousled", "color": "#241a14", "length_cm": 6},
                "wardrobe": [
                    {"garment_id": "garment.tshirt", "color": "#2f4a72", "material_id": None},
                    {"garment_id": "garment.jeans", "color": "#33415c", "material_id": None},
                ],
                "proportions": {"height_m": 1.78, "head_ratio": 7.5, "build": "average"},
                "identity_locked": ["identity_id", "proportions.height_m", "hair.color"],
            },
        ),
        _obj("chr_boy_head", "Head", "body_part", (0, 1.62, 0), parent="chr_boy", geometry={"kind": "primitive", "primitive": "sphere", "params": {"radius": 0.105}}, material="mat_skin", tags=["body_part", "head"]),
        _obj("chr_boy_hair", "Hair", "body_part", (0, 0.045, 0), parent="chr_boy_head", geometry={"kind": "procedural", "generator": "hair.card", "params": {"strands": 900}}, material="mat_hair_dark", tags=["body_part", "hair"]),
        _obj("chr_boy_arm_r", "Right_Arm", "body_part", (0.22, 1.32, 0), parent="chr_boy", geometry={"kind": "primitive", "primitive": "capsule", "params": {"radius": 0.05, "length": 0.6}}, material="mat_skin", tags=["body_part", "arm", "right"]),
        _obj("chr_boy_hand_r", "Right_Hand", "body_part", (0, -0.62, 0), parent="chr_boy_arm_r", geometry={"kind": "primitive", "primitive": "sphere", "params": {"radius": 0.05}}, material="mat_skin", tags=["body_part", "hand", "right", "grasp_socket"]),
        _obj(
            "cam_main",
            "Camera_Main",
            "camera",
            (0.2, 1.55, 3.4),
            tags=["camera", "hero"],
            camera={
                "focal_length_mm": 35,
                "sensor_width_mm": 36,
                "fstop": 2.8,
                "focus_distance_m": 3.2,
                "dof_enabled": True,
                "projection": "perspective",
                "shot_type": "medium",
                "movement": "dolly",
                "movement_params": {"distance_m": 0.8},
            },
        ),
        _obj(
            "lgt_key",
            "Key light",
            "light",
            (-1.6, 2.4, 1.2),
            tags=["light", "key"],
            light={"kind": "area", "intensity_watts": 220, "color": "#ffe9c9", "direction": [0.3, -1, -0.4], "size_m": 1.2, "shadows": True, "softness": 0.6, "color_temperature_k": 4300, "role": "key"},
        ),
        _obj(
            "lgt_fill",
            "Fill light",
            "light",
            (2.2, 1.8, 1.6),
            tags=["light", "fill"],
            light={"kind": "area", "intensity_watts": 60, "color": "#cfe0ff", "direction": [-0.5, -0.6, -0.6], "size_m": 2, "shadows": False, "softness": 0.9, "color_temperature_k": 6500, "role": "fill"},
        ),
        _obj(
            "lgt_window",
            "Window light",
            "light",
            (-2.9, 1.8, -0.4),
            tags=["light", "practical"],
            light={"kind": "sun", "intensity_watts": 4, "color": "#fff3dd", "direction": [0.85, -0.5, 0.2], "shadows": True, "softness": 0.25, "color_temperature_k": 5200, "role": "practical"},
        ),
    ]

    return {
        "schema_version": "1.1",
        "id": scene_id,
        "project_id": project_id,
        "name": "Boy, table, apple",
        "revision": 0,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
        "settings": {
            "fps": 24,
            "duration_frames": 240,
            "resolution": {"width": 1920, "height": 1080},
            "aspect_ratio": "16:9",
            "render_engine": "eevee",
            "samples": 64,
            "denoise": True,
            "motion_blur": False,
            "color_management": {"view_transform": "AgX", "look": "Medium High Contrast", "exposure": 0, "gamma": 1},
            "unit_scale_m": 1,
        },
        "environment": {
            "kind": "interior",
            "preset_id": "room.domestic.small",
            "time_of_day": "afternoon",
            "weather": "clear",
            "sky": {"kind": "procedural", "hdri_asset_id": None, "color": "#9fb7d4"},
            "atmosphere": {"fog_density": 0, "fog_color": "#c8d2de", "haze": 0},
            "terrain": {"preset_id": "flat", "params": {}},
            "vegetation_density": 0,
            "global_style": "cinematic",
        },
        "objects": objects,
        "materials": deepcopy(MATERIALS),
        "animations": [
            {
                "id": "anim_boy_walk",
                "name": "Walk to table",
                "target_id": "chr_boy",
                "kind": "transform",
                "start_frame": 0,
                "end_frame": 96,
                "loop": False,
                "source": {"kind": "manual", "model_id": None},
                "tracks": [
                    {
                        "id": "trk_walk_pos",
                        "channel": "transform.position",
                        "keyframes": [
                            {"id": "kf_0", "frame": 0, "value": [-2.4, 0, 1.4], "interpolation": "bezier"},
                            {"id": "kf_1", "frame": 96, "value": [0.45, 0, -0.85], "interpolation": "bezier"},
                        ],
                    }
                ],
            }
        ],
        "shots": [
            {"id": "shot_1", "index": 0, "name": "Establishing", "camera_id": "cam_main", "start_frame": 0, "end_frame": 48, "description": "Wide of the room.", "subjects": ["chr_boy"], "transition_in": "fade"},
            {"id": "shot_2", "index": 1, "name": "Approach", "camera_id": "cam_main", "start_frame": 48, "end_frame": 132, "description": "Dolly with the boy.", "subjects": ["chr_boy", "obj_table"], "transition_in": "cut"},
        ],
        "active_camera_id": "cam_main",
        "metadata": {},
    }
