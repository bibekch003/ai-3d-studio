import type {
  EnvironmentSettings,
  SceneDocument,
  SceneObject,
  SceneSettings,
  Transform,
} from "./types.js";
import { SCENE_SCHEMA_VERSION } from "./types.js";
import { newId } from "./ids.js";

export const IDENTITY_TRANSFORM: Transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

export function defaultSettings(): SceneSettings {
  return {
    fps: 24,
    duration_frames: 240,
    resolution: { width: 1920, height: 1080 },
    aspect_ratio: "16:9",
    render_engine: "eevee",
    samples: 64,
    denoise: true,
    motion_blur: false,
    color_management: { view_transform: "AgX", look: "Medium High Contrast", exposure: 0, gamma: 1 },
    unit_scale_m: 1,
  };
}

export function defaultEnvironment(): EnvironmentSettings {
  return {
    kind: "interior",
    preset_id: "room.studio.neutral",
    time_of_day: "afternoon",
    weather: "clear",
    sky: { kind: "procedural", hdri_asset_id: null, color: "#9fb7d4" },
    atmosphere: { fog_density: 0, fog_color: "#c8d2de", haze: 0 },
    terrain: { preset_id: "flat", params: {} },
    vegetation_density: 0,
    global_style: "cinematic",
  };
}

export function makeObject(partial: Partial<SceneObject> & Pick<SceneObject, "name" | "type">): SceneObject {
  return {
    id: partial.id ?? newId("obj"),
    name: partial.name,
    type: partial.type,
    parent_id: partial.parent_id ?? null,
    transform: partial.transform ?? { ...IDENTITY_TRANSFORM },
    geometry: partial.geometry ?? { kind: "none" },
    material_id: partial.material_id ?? null,
    material_overrides: partial.material_overrides ?? null,
    texture_refs: partial.texture_refs ?? [],
    animation_refs: partial.animation_refs ?? [],
    visible: partial.visible ?? true,
    locked: partial.locked ?? false,
    protected: partial.protected ?? false,
    tags: partial.tags ?? [],
    version: partial.version ?? 1,
    metadata: partial.metadata ?? {},
    ...(partial.character ? { character: partial.character } : {}),
    ...(partial.camera ? { camera: partial.camera } : {}),
    ...(partial.light ? { light: partial.light } : {}),
    ...(partial.audio ? { audio: partial.audio } : {}),
    ...(partial.particles ? { particles: partial.particles } : {}),
  };
}

export function emptyScene(params: {
  id?: string;
  projectId?: string;
  name?: string;
  now?: string;
}): SceneDocument {
  const now = params.now ?? new Date().toISOString();
  return {
    schema_version: SCENE_SCHEMA_VERSION,
    id: params.id ?? newId("scn"),
    project_id: params.projectId ?? newId("prj"),
    name: params.name ?? "Untitled scene",
    revision: 0,
    created_at: now,
    updated_at: now,
    settings: defaultSettings(),
    environment: defaultEnvironment(),
    objects: [],
    materials: [],
    animations: [],
    shots: [],
    active_camera_id: null,
    metadata: {},
  };
}
