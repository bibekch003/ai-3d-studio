import { z } from "zod";
import { SCENE_SCHEMA_VERSION, type SceneDocument } from "./types.js";

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

export const vec3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
export const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "expected #rgb or #rrggbb");

const unit = z.number().min(0).max(1);

export const transformSchema = z.object({
  position: vec3,
  rotation: vec3,
  scale: vec3,
});

export const objectTypeSchema = z.enum([
  "character",
  "body_part",
  "prop",
  "furniture",
  "plant",
  "vehicle",
  "building",
  "environment",
  "camera",
  "light",
  "audio",
  "particles",
  "group",
]);

export const geometrySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("primitive"),
    primitive: z.enum(["box", "sphere", "cylinder", "cone", "plane", "torus", "capsule"]),
    params: z.record(z.number().finite()).default({}),
  }),
  z.object({
    kind: z.literal("asset"),
    asset_id: z.string().min(1),
    format: z.enum(["glb", "gltf", "fbx", "obj"]),
    lod: z.number().int().min(0).max(4).optional(),
  }),
  z.object({
    kind: z.literal("procedural"),
    generator: z.string().min(1),
    params: z.record(z.unknown()).default({}),
  }),
  z.object({ kind: z.literal("none") }),
]);

export const materialSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  base_color: hexColor,
  roughness: unit,
  metallic: unit,
  emissive: hexColor.optional(),
  emissive_strength: z.number().min(0).max(100).optional(),
  opacity: unit.optional(),
  ior: z.number().min(1).max(3).optional(),
  base_color_texture_id: z.string().nullable().optional(),
  roughness_texture_id: z.string().nullable().optional(),
  normal_texture_id: z.string().nullable().optional(),
  displacement_texture_id: z.string().nullable().optional(),
  displacement_scale: z.number().optional(),
  procedural: z
    .object({ id: z.string().min(1), params: z.record(z.union([z.number(), z.string(), z.boolean()])) })
    .nullable()
    .optional(),
});

export const characterSchema = z.object({
  identity_id: z.string().min(1),
  profile_id: z.string().nullable().optional(),
  age_band: z.enum(["child", "teen", "adult", "senior", "unspecified"]).optional(),
  expression: z.record(unit).default({}),
  pose: z.object({
    rig_id: z.string().min(1),
    bone_rotations: z.record(vec3).default({}),
    bone_translations: z.record(vec3).default({}),
    ik_targets: z.record(vec3).default({}),
  }),
  hair: z.object({ style_id: z.string(), color: hexColor, length_cm: z.number().min(0).max(300).optional() }),
  wardrobe: z
    .array(z.object({ garment_id: z.string(), color: hexColor, material_id: z.string().nullable().optional() }))
    .default([]),
  proportions: z.object({
    height_m: z.number().min(0.3).max(3),
    head_ratio: z.number().min(4).max(10).optional(),
    build: z.enum(["slim", "average", "athletic", "heavy"]).optional(),
  }),
  identity_locked: z.array(z.string()).default([]),
});

export const cameraSchema = z.object({
  focal_length_mm: z.number().min(4).max(1200),
  sensor_width_mm: z.number().min(4).max(100),
  fstop: z.number().min(0.7).max(64),
  focus_distance_m: z.number().min(0.05).max(1000),
  dof_enabled: z.boolean(),
  projection: z.enum(["perspective", "orthographic"]),
  shot_type: z.enum(["extreme_wide", "wide", "medium", "close_up", "extreme_close_up", "over_the_shoulder", "pov"]),
  movement: z.enum(["static", "pan", "tilt", "dolly", "truck", "crane", "handheld", "orbit"]),
  movement_params: z.record(z.number()).default({}),
});

export const lightSchema = z.object({
  kind: z.enum(["point", "spot", "sun", "area"]),
  intensity_watts: z.number().min(0).max(1_000_000),
  color: hexColor,
  direction: vec3,
  angle_deg: z.number().min(0).max(180).optional(),
  size_m: z.number().min(0).max(1000).optional(),
  shadows: z.boolean(),
  softness: unit,
  color_temperature_k: z.number().min(1000).max(20000).optional(),
  role: z.enum(["key", "fill", "rim", "practical", "ambient"]),
});

export const audioSchema = z.object({
  kind: z.enum(["music", "sfx", "voice", "dialogue", "ambience"]),
  asset_id: z.string().nullable(),
  gain_db: z.number().min(-96).max(24),
  start_frame: z.number().int().min(0),
  end_frame: z.number().int().min(0),
  loop: z.boolean(),
  lipsync_target_id: z.string().nullable().optional(),
  licence_note: z.string().optional(),
});

export const particlesSchema = z.object({
  emitter_shape: z.enum(["box", "sphere", "plane"]),
  emitter_params: z.record(z.number()).default({}),
  rate: z.number().min(0),
  lifetime_frames: z.number().int().min(1),
  system: z.enum(["dust", "smoke", "fire", "rain", "snow", "sparks", "custom"]),
  params: z.record(z.union([z.number(), z.string(), z.boolean()])).default({}),
});

export const sceneObjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: objectTypeSchema,
  parent_id: z.string().nullable(),
  transform: transformSchema,
  geometry: geometrySchema,
  material_id: z.string().nullable(),
  material_overrides: materialSchema.partial().nullable(),
  texture_refs: z.array(z.string()).default([]),
  animation_refs: z.array(z.string()).default([]),
  visible: z.boolean(),
  locked: z.boolean(),
  protected: z.boolean(),
  tags: z.array(z.string()).default([]),
  version: z.number().int().min(0),
  character: characterSchema.optional(),
  camera: cameraSchema.optional(),
  light: lightSchema.optional(),
  audio: audioSchema.optional(),
  particles: particlesSchema.optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const keyframeSchema = z.object({
  id: z.string().min(1),
  frame: z.number().int().min(0),
  value: z.union([z.number(), vec3, z.string(), z.boolean()]),
  interpolation: z.enum(["linear", "bezier", "step"]),
});

export const animationClipSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  target_id: z.string().min(1),
  kind: z.enum(["transform", "pose", "shape_key", "material", "camera", "visibility", "audio"]),
  start_frame: z.number().int().min(0),
  end_frame: z.number().int().min(0),
  loop: z.boolean(),
  source: z.object({
    kind: z.enum(["manual", "library", "ai"]),
    model_id: z.string().nullable().optional(),
    prompt: z.string().optional(),
  }),
  tracks: z.array(
    z.object({
      id: z.string().min(1),
      channel: z.string().min(1),
      keyframes: z.array(keyframeSchema).default([]),
    }),
  ),
});

export const shotSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().min(0),
  name: z.string().min(1),
  camera_id: z.string().nullable(),
  start_frame: z.number().int().min(0),
  end_frame: z.number().int().min(0),
  description: z.string(),
  subjects: z.array(z.string()).default([]),
  transition_in: z.enum(["cut", "fade", "dissolve", "wipe"]),
});

export const visualStyleSchema = z.enum([
  "photoreal",
  "cinematic",
  "stylised",
  "anime",
  "clay_render",
  "low_poly",
  "noir",
  "custom",
]);

export const environmentSchema = z.object({
  kind: z.enum(["interior", "exterior", "studio", "abstract"]),
  preset_id: z.string(),
  time_of_day: z.enum(["dawn", "morning", "noon", "afternoon", "sunset", "dusk", "night"]),
  weather: z.enum(["clear", "cloudy", "overcast", "rain", "snow", "fog", "storm"]),
  sky: z.object({
    kind: z.enum(["procedural", "hdri", "solid"]),
    hdri_asset_id: z.string().nullable(),
    color: hexColor,
  }),
  atmosphere: z.object({ fog_density: z.number().min(0).max(1), fog_color: hexColor, haze: unit }),
  terrain: z.object({ preset_id: z.string(), params: z.record(z.number()) }),
  vegetation_density: unit,
  global_style: visualStyleSchema,
});

export const sceneSettingsSchema = z.object({
  fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(60)]),
  duration_frames: z.number().int().min(1).max(216000),
  resolution: z.object({
    width: z.number().int().min(64).max(7680),
    height: z.number().int().min(64).max(4320),
  }),
  aspect_ratio: z.string(),
  render_engine: z.enum(["eevee", "cycles"]),
  samples: z.number().int().min(1).max(8192),
  denoise: z.boolean(),
  motion_blur: z.boolean(),
  color_management: z.object({
    view_transform: z.enum(["AgX", "Filmic", "Standard", "Khronos PBR Neutral"]),
    look: z.string(),
    exposure: z.number().min(-16).max(16),
    gamma: z.number().min(0.1).max(5),
  }),
  unit_scale_m: z.number().min(0.001).max(1000),
});

export const sceneSchema = z.object({
  schema_version: z.string().min(1),
  id: z.string().min(1),
  project_id: z.string().min(1),
  name: z.string().min(1),
  revision: z.number().int().min(0),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  settings: sceneSettingsSchema,
  environment: environmentSchema,
  objects: z.array(sceneObjectSchema),
  materials: z.array(materialSchema).default([]),
  animations: z.array(animationClipSchema).default([]),
  shots: z.array(shotSchema).default([]),
  active_camera_id: z.string().nullable(),
  metadata: z.record(z.unknown()).default({}),
});

export const MAX_SCENE_OBJECTS = 5000;

/**
 * Validates a scene document: structural schema first, then graph invariants.
 * Returns errors and warnings separately so the UI can block on errors only.
 */
export function validateScene(input: unknown) {
  const errors: { code: string; message: string; path?: string; severity: "error" | "warning" }[] = [];
  const warnings: typeof errors = [];

  const parsed = sceneSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        code: "schema.invalid",
        message: issue.message,
        path: issue.path.join("."),
        severity: "error",
      });
    }
    return { ok: false, errors, warnings, data: null as SceneDocument | null };
  }

  const scene = parsed.data as unknown as SceneDocument;

  if (scene.schema_version !== SCENE_SCHEMA_VERSION) {
    warnings.push({
      code: "schema.version_mismatch",
      message: `Scene schema ${scene.schema_version} differs from current ${SCENE_SCHEMA_VERSION}; run migrateScene().`,
      path: "schema_version",
      severity: "warning",
    });
  }

  if (scene.objects.length > MAX_SCENE_OBJECTS) {
    errors.push({
      code: "scene.too_many_objects",
      message: `Scene has ${scene.objects.length} objects, limit is ${MAX_SCENE_OBJECTS}.`,
      path: "objects",
      severity: "error",
    });
  }

  const byId = new Map<string, SceneDocument["objects"][number]>();
  for (const obj of scene.objects) {
    if (byId.has(obj.id)) {
      errors.push({ code: "graph.duplicate_id", message: `Duplicate object id ${obj.id}`, path: "objects", severity: "error" });
    }
    byId.set(obj.id, obj);
  }

  for (const obj of scene.objects) {
    if (obj.parent_id !== null && !byId.has(obj.parent_id)) {
      errors.push({
        code: "graph.missing_parent",
        message: `Object ${obj.name} references missing parent ${obj.parent_id}`,
        path: `objects.${obj.id}.parent_id`,
        severity: "error",
      });
    }
    if (obj.parent_id === obj.id) {
      errors.push({ code: "graph.self_parent", message: `Object ${obj.name} is its own parent`, severity: "error" });
    }
    if (obj.type === "camera" && !obj.camera) {
      errors.push({ code: "camera.settings_missing", message: `Camera ${obj.name} has no camera settings`, severity: "error" });
    }
    if (obj.type === "light" && !obj.light) {
      errors.push({ code: "light.settings_missing", message: `Light ${obj.name} has no light settings`, severity: "error" });
    }
    if (obj.type === "character" && !obj.character) {
      errors.push({ code: "character.state_missing", message: `Character ${obj.name} has no character state`, severity: "error" });
    }
    if (obj.type !== "camera" && obj.camera) {
      warnings.push({ code: "camera.on_non_camera", message: `Non-camera object ${obj.name} carries camera settings`, severity: "warning" });
    }
  }

  // cycle detection
  for (const obj of scene.objects) {
    const seen = new Set<string>();
    let cursor: string | null = obj.parent_id;
    while (cursor) {
      if (cursor === obj.id || seen.has(cursor)) {
        errors.push({ code: "graph.cycle", message: `Cycle detected in hierarchy at ${obj.name}`, severity: "error" });
        break;
      }
      seen.add(cursor);
      cursor = byId.get(cursor)?.parent_id ?? null;
    }
  }

  if (scene.active_camera_id && !byId.has(scene.active_camera_id)) {
    errors.push({ code: "camera.active_missing", message: `Active camera ${scene.active_camera_id} does not exist`, severity: "error" });
  }

  const materialIds = new Set(scene.materials.map((m) => m.id));
  for (const obj of scene.objects) {
    if (obj.material_id && !materialIds.has(obj.material_id)) {
      warnings.push({
        code: "material.unresolved",
        message: `Object ${obj.name} references material ${obj.material_id} that is not in the scene`,
        severity: "warning",
      });
    }
  }

  for (const clip of scene.animations) {
    if (!byId.has(clip.target_id)) {
      errors.push({ code: "animation.target_missing", message: `Animation ${clip.name} targets missing object`, severity: "error" });
    }
    if (clip.end_frame < clip.start_frame) {
      errors.push({ code: "animation.range_invalid", message: `Animation ${clip.name} ends before it starts`, severity: "error" });
    }
    if (clip.end_frame > scene.settings.duration_frames) {
      warnings.push({
        code: "animation.out_of_range",
        message: `Animation ${clip.name} extends past the scene duration`,
        severity: "warning",
      });
    }
  }

  for (const shot of scene.shots) {
    if (shot.camera_id && !byId.has(shot.camera_id)) {
      errors.push({ code: "shot.camera_missing", message: `Shot ${shot.name} references a missing camera`, severity: "error" });
    }
    if (shot.end_frame <= shot.start_frame) {
      errors.push({ code: "shot.range_invalid", message: `Shot ${shot.name} has a non-positive duration`, severity: "error" });
    }
  }

  return { ok: errors.length === 0, errors, warnings, data: scene };
}

export type SceneParseResult = ReturnType<typeof validateScene>;
