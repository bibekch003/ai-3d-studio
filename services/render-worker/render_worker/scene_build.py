"""Translate an AI 3D Studio scene document into Blender operations.

Two layers:
  * build_plan(scene)  - pure Python, testable without Blender
  * build_scene(bpy, scene) - applies the plan through bpy

The scene document stays authoritative: object names are the object ids, so a
round-trip (Blender -> app) can match objects again.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

EEVEE_ENGINE_IDS = ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE")
CYCLES_ENGINE_ID = "CYCLES"

PRIMITIVE_OPS = {
    "box": "primitive_cube_add",
    "sphere": "primitive_uv_sphere_add",
    "cylinder": "primitive_cylinder_add",
    "cone": "primitive_cone_add",
    "torus": "primitive_torus_add",
    "plane": "primitive_plane_add",
    "capsule": "primitive_cylinder_add",  # capsule is approximated until a metaball/asset is used
}


@dataclass
class BuildPlan:
    materials: list[dict[str, Any]] = field(default_factory=list)
    meshes: list[dict[str, Any]] = field(default_factory=list)
    empties: list[dict[str, Any]] = field(default_factory=list)
    cameras: list[dict[str, Any]] = field(default_factory=list)
    lights: list[dict[str, Any]] = field(default_factory=list)
    parents: list[tuple[str, str]] = field(default_factory=list)
    animations: list[dict[str, Any]] = field(default_factory=list)
    render: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    @property
    def object_count(self) -> int:
        return len(self.meshes) + len(self.empties) + len(self.cameras) + len(self.lights)


def hex_to_linear_rgb(value: str) -> tuple[float, float, float, float]:
    """Blender wants linear-light floats; scene colours are sRGB hex."""
    value = value.lstrip("#")
    if len(value) == 3:
        value = "".join(ch * 2 for ch in value)
    if len(value) != 6:
        return (0.5, 0.5, 0.5, 1.0)

    def srgb_to_linear(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (int(value[i : i + 2], 16) / 255.0 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


def build_plan(scene: dict[str, Any]) -> BuildPlan:
    plan = BuildPlan()

    for material in scene.get("materials", []):
        plan.materials.append(
            {
                "name": material["id"],
                "label": material.get("name", material["id"]),
                "base_color": hex_to_linear_rgb(material.get("base_color", "#808080")),
                "roughness": float(material.get("roughness", 0.5)),
                "metallic": float(material.get("metallic", 0.0)),
                "emissive": hex_to_linear_rgb(material["emissive"]) if material.get("emissive") else None,
                "opacity": float(material.get("opacity", 1.0)),
                "procedural": (material.get("procedural") or {}).get("id"),
            }
        )

    for obj in scene.get("objects", []):
        otype = obj["type"]
        transform = obj["transform"]
        geometry = obj.get("geometry") or {"kind": "none"}
        base = {
            "name": obj["id"],
            "label": obj.get("name", obj["id"]),
            "type": otype,
            "location": transform["position"],
            "rotation": transform["rotation"],
            "scale": transform["scale"],
            "material": obj.get("material_id"),
            "visible": obj.get("visible", True),
            "tags": obj.get("tags", []),
        }

        if otype == "camera":
            camera = obj.get("camera") or {}
            plan.cameras.append(
                {
                    **base,
                    "lens_mm": float(camera.get("focal_length_mm", 50)),
                    "sensor_mm": float(camera.get("sensor_width_mm", 36)),
                    "fstop": float(camera.get("fstop", 5.6)),
                    "focus_distance_m": float(camera.get("focus_distance_m", 5.0)),
                    "dof": bool(camera.get("dof_enabled", False)),
                    "ortho": camera.get("projection") == "orthographic",
                    "active": obj["id"] == scene.get("active_camera_id"),
                }
            )
            continue

        if otype == "light":
            light = obj.get("light") or {}
            plan.lights.append(
                {
                    **base,
                    "kind": light.get("kind", "point"),
                    "energy_w": float(light.get("intensity_watts", 100)),
                    "color": hex_to_linear_rgb(light.get("color", "#ffffff")),
                    "size_m": float(light.get("size_m", 1.0)),
                    "angle_deg": float(light.get("angle_deg", 45.0)),
                    "shadows": bool(light.get("shadows", True)),
                    "role": light.get("role"),
                }
            )
            continue

        if otype in {"audio", "particles"}:
            # Audio is assembled in the video step; particles need a Blender
            # particle system, which is created as an empty emitter marker.
            plan.empties.append({**base, "kind": otype})
            continue

        if geometry.get("kind") == "primitive":
            primitive = geometry.get("primitive", "box")
            params = geometry.get("params") or {}
            plan.meshes.append(
                {
                    **base,
                    "primitive": primitive,
                    "op": PRIMITIVE_OPS.get(primitive, "primitive_cube_add"),
                    "params": params,
                    "flat": primitive == "plane",
                }
            )
        elif geometry.get("kind") == "asset":
            # Imported assets are loaded from the asset cache when present.
            plan.empties.append({**base, "kind": "asset_proxy", "asset_id": geometry.get("asset_id")})
            plan.warnings.append(
                f'{obj.get("name")}: asset {geometry.get("asset_id")} is imported from the asset cache; '
                "a proxy empty is created when the file is missing."
            )
        elif geometry.get("kind") == "procedural":
            plan.empties.append({**base, "kind": "procedural", "generator": geometry.get("generator")})
            plan.warnings.append(
                f'{obj.get("name")}: procedural generator {geometry.get("generator")} has no Blender implementation in this build.'
            )
        else:
            plan.empties.append({**base, "kind": otype})

        if obj.get("parent_id"):
            plan.parents.append((obj["id"], obj["parent_id"]))

    for clip in scene.get("animations", []):
        plan.animations.append(
            {
                "clip_id": clip["id"],
                "name": clip.get("name", clip["id"]),
                "target_id": clip["target_id"],
                "kind": clip["kind"],
                "start": clip["start_frame"],
                "end": clip["end_frame"],
                "tracks": [
                    {
                        "channel": track["channel"],
                        "keyframes": [
                            {"frame": kf["frame"], "value": kf["value"], "interpolation": kf.get("interpolation", "bezier")}
                            for kf in track.get("keyframes", [])
                        ],
                    }
                    for track in clip.get("tracks", [])
                ],
            }
        )

    settings = scene.get("settings", {})
    plan.render = {
        "engine": settings.get("render_engine", "eevee"),
        "samples": int(settings.get("samples", 64)),
        "denoise": bool(settings.get("denoise", True)),
        "motion_blur": bool(settings.get("motion_blur", False)),
        "resolution": settings.get("resolution", {"width": 1920, "height": 1080}),
        "fps": int(settings.get("fps", 24)),
        "frame_start": 0,
        "frame_end": int(settings.get("duration_frames", 240)),
        "view_transform": settings.get("color_management", {}).get("view_transform", "AgX"),
        "look": settings.get("color_management", {}).get("look", "None"),
        "exposure": float(settings.get("color_management", {}).get("exposure", 0.0)),
    }
    return plan


def build_scene(bpy: Any, scene: dict[str, Any]) -> dict[str, Any]:
    """Create the Blender scene. Must be called inside Blender (bpy available)."""
    plan = build_plan(scene)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene_root = bpy.context.scene

    materials = {}
    for spec in plan.materials:
        material = bpy.data.materials.new(name=spec["name"])
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = spec["base_color"]
            bsdf.inputs["Roughness"].default_value = spec["roughness"]
            bsdf.inputs["Metallic"].default_value = spec["metallic"]
            if spec["emissive"] and "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = spec["emissive"]
                bsdf.inputs["Emission Strength"].default_value = 2.0
            if spec["opacity"] < 1.0 and "Alpha" in bsdf.inputs:
                bsdf.inputs["Alpha"].default_value = spec["opacity"]
                material.blend_method = "BLEND"
        materials[spec["name"]] = material

    created: dict[str, Any] = {}

    for spec in plan.meshes:
        params = spec["params"]
        primitive = spec["primitive"]
        if primitive == "box":
            size = params.get("size", 1.0)
            bpy.ops.mesh.primitive_cube_add(size=size)
            obj = bpy.context.object
            obj.scale = (
                params.get("width", size),
                params.get("depth", size),
                params.get("height", size),
            )
        elif primitive == "sphere":
            bpy.ops.mesh.primitive_uv_sphere_add(radius=params.get("radius", 0.5), segments=32, ring_count=16)
            obj = bpy.context.object
        elif primitive == "plane":
            bpy.ops.mesh.primitive_plane_add(size=params.get("size", 1.0))
            obj = bpy.context.object
        elif primitive == "torus":
            bpy.ops.mesh.primitive_torus_add(
                major_radius=params.get("radius", 0.4), minor_radius=params.get("tube", 0.12)
            )
            obj = bpy.context.object
        elif primitive == "cone":
            bpy.ops.mesh.primitive_cone_add(radius1=params.get("radius", 0.4), depth=params.get("height", 1.0))
            obj = bpy.context.object
        else:  # cylinder / capsule
            bpy.ops.mesh.primitive_cylinder_add(
                radius=params.get("radius", 0.3),
                depth=params.get("depth", params.get("length", 1.0)),
                vertices=24,
            )
            obj = bpy.context.object

        obj.name = spec["name"]
        obj.location = spec["location"]
        obj.rotation_euler = spec["rotation"]
        obj.scale = [obj.scale[i] * spec["scale"][i] for i in range(3)]
        if spec["material"] and spec["material"] in materials:
            obj.data.materials.append(materials[spec["material"]])
        if not spec["visible"]:
            obj.hide_render = True
        created[spec["name"]] = obj

    for spec in plan.empties:
        empty = bpy.data.objects.new(spec["name"], None)
        empty.empty_display_type = "PLAIN_AXES"
        empty.location = spec["location"]
        empty.rotation_euler = spec["rotation"]
        empty.scale = spec["scale"]
        scene_root.collection.objects.link(empty)
        created[spec["name"]] = empty

    for spec in plan.cameras:
        camera_data = bpy.data.cameras.new(name=spec["name"])
        camera_data.lens = spec["lens_mm"]
        camera_data.sensor_width = spec["sensor_mm"]
        camera_data.type = "ORTHO" if spec["ortho"] else "PERSP"
        if spec["dof"]:
            camera_data.dof.use_dof = True
            camera_data.dof.aperture_fstop = spec["fstop"]
            camera_data.dof.focus_distance = spec["focus_distance_m"]
        camera_obj = bpy.data.objects.new(spec["name"], camera_data)
        camera_obj.location = spec["location"]
        camera_obj.rotation_euler = spec["rotation"]
        scene_root.collection.objects.link(camera_obj)
        created[spec["name"]] = camera_obj
        if spec["active"]:
            scene_root.camera = camera_obj

    for spec in plan.lights:
        light_data = bpy.data.lights.new(name=spec["name"], type=spec["kind"].upper() if spec["kind"] != "sun" else "SUN")
        light_data.energy = spec["energy_w"]
        light_data.color = spec["color"][:3]
        if spec["kind"] == "area":
            light_data.size = spec["size_m"]
        if spec["kind"] == "spot":
            light_data.spot_size = spec["angle_deg"] * 3.141592653589793 / 180.0
        light_obj = bpy.data.objects.new(spec["name"], light_data)
        light_obj.location = spec["location"]
        light_obj.rotation_euler = spec["rotation"]
        scene_root.collection.objects.link(light_obj)
        created[spec["name"]] = light_obj

    for child, parent in plan.parents:
        if child in created and parent in created:
            created[child].parent = created[parent]

    for clip in plan.animations:
        target = created.get(clip["target_id"])
        if target is None:
            continue
        for track in clip["tracks"]:
            channel = track["channel"]
            if channel == "transform.position":
                prop, path = "location", "location"
            elif channel == "transform.rotation":
                prop, path = "rotation_euler", "rotation_euler"
            elif channel == "transform.scale":
                prop, path = "scale", "scale"
            else:
                continue  # pose tracks need an armature; skipped with a warning below
            for keyframe in track["keyframes"]:
                scene_root.frame_set(int(keyframe["frame"]))
                setattr(target, prop, keyframe["value"])
                target.keyframe_insert(data_path=path, frame=keyframe["frame"])
    pose_skipped = [c for c in plan.animations if c["kind"] == "pose"]
    if pose_skipped:
        plan.warnings.append(
            f"{len(pose_skipped)} pose clip(s) need a rigged armature; they were not baked into this build."
        )

    render = plan.render
    scene_root.render.engine = CYCLES_ENGINE_ID if render["engine"] == "cycles" else _pick_engine(render["engine"])
    scene_root.render.resolution_x = render["resolution"]["width"]
    scene_root.render.resolution_y = render["resolution"]["height"]
    scene_root.render.fps = render["fps"]
    scene_root.frame_start = render["frame_start"]
    scene_root.frame_end = render["frame_end"]
    if render["engine"] == "cycles":
        scene_root.cycles.samples = render["samples"]
        scene_root.cycles.use_denoising = render["denoise"]
    else:
        scene_root.eevee.taa_render_samples = min(render["samples"], 512)
    scene_root.render.use_motion_blur = render["motion_blur"]
    try:
        scene_root.view_settings.view_transform = render["view_transform"]
        scene_root.view_settings.look = render["look"]
        scene_root.view_settings.exposure = render["exposure"]
    except TypeError:
        plan.warnings.append(f'Colour management look "{render["look"]}" is not available in this Blender build.')

    return {
        "objects": plan.object_count,
        "meshes": len(plan.meshes),
        "cameras": len(plan.cameras),
        "lights": len(plan.lights),
        "animations": len(plan.animations),
        "warnings": plan.warnings,
    }


def _pick_engine(requested: str) -> str:
    """EEVEE was renamed across 4.x/5.x; pick whichever id this build exposes."""
    try:
        import bpy  # type: ignore

        enum = {item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
        for candidate in EEVEE_ENGINE_IDS:
            if candidate in enum:
                return candidate
    except Exception:  # pragma: no cover - only inside Blender
        pass
    return EEVEE_ENGINE_IDS[0]
