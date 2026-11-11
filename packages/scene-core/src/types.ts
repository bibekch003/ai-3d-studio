/**
 * Application-owned scene document model.
 *
 * The scene document is the single source of truth for a shot: it is what the
 * editor mutates, what the API stores, what Blender is rebuilt from and what is
 * versioned. Blender is a *production engine*, not the database.
 */

export const SCENE_SCHEMA_VERSION = "1.1" as const;

/** Oldest schema version the current codebase can still open. */
export const MIN_SUPPORTED_SCHEMA_VERSION = "1.0" as const;

export type Vec3 = [number, number, number];
export type HexColor = string;

export type ObjectType =
  | "character"
  | "body_part"
  | "prop"
  | "furniture"
  | "plant"
  | "vehicle"
  | "building"
  | "environment"
  | "camera"
  | "light"
  | "audio"
  | "particles"
  | "group";

/** Types that can own children in the scene graph. */
export const CONTAINER_TYPES: readonly ObjectType[] = [
  "character",
  "body_part",
  "group",
  "environment",
  "building",
];

export interface Transform {
  position: Vec3;
  /** Euler XYZ in radians. */
  rotation: Vec3;
  scale: Vec3;
}

export type PrimitiveKind = "box" | "sphere" | "cylinder" | "cone" | "plane" | "torus" | "capsule";

export type GeometrySpec =
  | { kind: "primitive"; primitive: PrimitiveKind; params: Record<string, number> }
  | { kind: "asset"; asset_id: string; format: "glb" | "gltf" | "fbx" | "obj"; lod?: number }
  | { kind: "procedural"; generator: string; params: Record<string, unknown> }
  | { kind: "none" };

export interface ProceduralRecipe {
  /** Registry id, e.g. "wood.oak.aged". Never raw shader source. */
  id: string;
  params: Record<string, number | string | boolean>;
}

export interface PbrMaterial {
  id: string;
  name: string;
  base_color: HexColor;
  roughness: number;
  metallic: number;
  emissive?: HexColor;
  emissive_strength?: number;
  opacity?: number;
  ior?: number;
  /** Asset ids for maps; null when the channel is procedural or unset. */
  base_color_texture_id?: string | null;
  roughness_texture_id?: string | null;
  normal_texture_id?: string | null;
  displacement_texture_id?: string | null;
  displacement_scale?: number;
  procedural?: ProceduralRecipe | null;
}

export interface RigState {
  rig_id: string;
  /** Bone name -> local rotation (radians) overrides for the current pose. */
  bone_rotations: Record<string, Vec3>;
  /** Bone name -> local translation offsets (metres). */
  bone_translations: Record<string, Vec3>;
  ik_targets: Record<string, Vec3>;
}

export interface CharacterState {
  /** Stable identity key so the same character can recur across shots. */
  identity_id: string;
  profile_id?: string | null;
  age_band?: "child" | "teen" | "adult" | "senior" | "unspecified";
  /** Blend-shape / morph weights in 0..1. */
  expression: Record<string, number>;
  pose: RigState;
  hair: { style_id: string; color: HexColor; length_cm?: number };
  wardrobe: { garment_id: string; color: HexColor; material_id?: string | null }[];
  proportions: { height_m: number; head_ratio?: number; build?: "slim" | "average" | "athletic" | "heavy" };
  /** Attributes the editor must not silently change (identity lock). */
  identity_locked: string[];
}

export interface CameraSettings {
  focal_length_mm: number;
  sensor_width_mm: number;
  fstop: number;
  focus_distance_m: number;
  dof_enabled: boolean;
  /** Blender camera type. */
  projection: "perspective" | "orthographic";
  shot_type: "extreme_wide" | "wide" | "medium" | "close_up" | "extreme_close_up" | "over_the_shoulder" | "pov";
  movement: "static" | "pan" | "tilt" | "dolly" | "truck" | "crane" | "handheld" | "orbit";
  movement_params: Record<string, number>;
}

export type LightKind = "point" | "spot" | "sun" | "area";

export interface LightSettings {
  kind: LightKind;
  intensity_watts: number;
  color: HexColor;
  /** Direction the light points, normalised by the engine. */
  direction: Vec3;
  angle_deg?: number;
  size_m?: number;
  shadows: boolean;
  softness: number;
  color_temperature_k?: number;
  /** Authoring role, used by the AI cinematographer. */
  role: "key" | "fill" | "rim" | "practical" | "ambient";
}

export interface AudioSettings {
  kind: "music" | "sfx" | "voice" | "dialogue" | "ambience";
  asset_id: string | null;
  gain_db: number;
  start_frame: number;
  end_frame: number;
  loop: boolean;
  /** Object id whose mouth should be lip-synced to this clip. */
  lipsync_target_id?: string | null;
  licence_note?: string;
}

export interface ParticleSettings {
  emitter_shape: "box" | "sphere" | "plane";
  emitter_params: Record<string, number>;
  rate: number;
  lifetime_frames: number;
  system: "dust" | "smoke" | "fire" | "rain" | "snow" | "sparks" | "custom";
  params: Record<string, number | string | boolean>;
}

export interface SceneObject {
  id: string;
  name: string;
  type: ObjectType;
  parent_id: string | null;
  transform: Transform;
  geometry: GeometrySpec;
  material_id: string | null;
  material_overrides: Partial<PbrMaterial> | null;
  texture_refs: string[];
  animation_refs: string[];
  visible: boolean;
  locked: boolean;
  /** Protected objects reject AI edits unless the plan explicitly overrides. */
  protected: boolean;
  tags: string[];
  /** Monotonic per-object revision, bumped by the editor on every change. */
  version: number;
  character?: CharacterState;
  camera?: CameraSettings;
  light?: LightSettings;
  audio?: AudioSettings;
  particles?: ParticleSettings;
  metadata: Record<string, unknown>;
}

export type Interpolation = "linear" | "bezier" | "step";

export interface Keyframe {
  id: string;
  frame: number;
  value: number | Vec3 | string | boolean;
  interpolation: Interpolation;
}

export interface AnimationTrack {
  id: string;
  /** Dotted channel path, e.g. "transform.position", "pose.bone.spine.rotation". */
  channel: string;
  keyframes: Keyframe[];
}

export type AnimationKind = "transform" | "pose" | "shape_key" | "material" | "camera" | "visibility" | "audio";

export interface AnimationClip {
  id: string;
  name: string;
  target_id: string;
  kind: AnimationKind;
  start_frame: number;
  end_frame: number;
  loop: boolean;
  source: {
    kind: "manual" | "library" | "ai";
    /** Registry id of the model that produced this clip, when kind === "ai". */
    model_id?: string | null;
    prompt?: string;
  };
  tracks: AnimationTrack[];
}

export interface Shot {
  id: string;
  index: number;
  name: string;
  camera_id: string | null;
  start_frame: number;
  end_frame: number;
  description: string;
  /** Scene-object ids that appear in this shot (continuity bookkeeping). */
  subjects: string[];
  transition_in: "cut" | "fade" | "dissolve" | "wipe";
}

export interface EnvironmentSettings {
  kind: "interior" | "exterior" | "studio" | "abstract";
  preset_id: string;
  time_of_day: "dawn" | "morning" | "noon" | "afternoon" | "sunset" | "dusk" | "night";
  weather: "clear" | "cloudy" | "overcast" | "rain" | "snow" | "fog" | "storm";
  sky: { kind: "procedural" | "hdri" | "solid"; hdri_asset_id: string | null; color: HexColor };
  atmosphere: { fog_density: number; fog_color: HexColor; haze: number };
  terrain: { preset_id: string; params: Record<string, number> };
  vegetation_density: number;
  global_style: VisualStyle;
}

export type VisualStyle =
  | "photoreal"
  | "cinematic"
  | "stylised"
  | "anime"
  | "clay_render"
  | "low_poly"
  | "noir"
  | "custom";

export interface ColorManagement {
  view_transform: "AgX" | "Filmic" | "Standard" | "Khronos PBR Neutral";
  look: string;
  exposure: number;
  gamma: number;
}

export interface SceneSettings {
  fps: 24 | 25 | 30 | 60;
  duration_frames: number;
  resolution: { width: number; height: number };
  aspect_ratio: string;
  render_engine: "eevee" | "cycles";
  samples: number;
  denoise: boolean;
  motion_blur: boolean;
  color_management: ColorManagement;
  unit_scale_m: number;
}

export interface SceneDocument {
  schema_version: string;
  id: string;
  project_id: string;
  name: string;
  revision: number;
  created_at: string;
  updated_at: string;
  settings: SceneSettings;
  environment: EnvironmentSettings;
  objects: SceneObject[];
  materials: PbrMaterial[];
  animations: AnimationClip[];
  shots: Shot[];
  active_camera_id: string | null;
  metadata: Record<string, unknown>;
}

/* ------------------------------------------------------------------------- */
/* Edit plans                                                                 */
/* ------------------------------------------------------------------------- */

export type EditOperation =
  | { op: "set_transform"; target_id: string; params: { position?: Vec3; rotation?: Vec3; scale?: Vec3 } }
  | { op: "set_material"; target_id: string; params: { patch: Partial<PbrMaterial> } }
  | { op: "set_geometry_param"; target_id: string; params: { param: string; value: number } }
  | { op: "replace_geometry"; target_id: string; params: { geometry: GeometrySpec } }
  | { op: "set_visibility"; target_id: string; params: { visible: boolean } }
  | { op: "set_locked"; target_id: string; params: { locked: boolean } }
  | { op: "rename"; target_id: string; params: { name: string } }
  | { op: "reparent"; target_id: string; params: { parent_id: string | null } }
  | { op: "add_object"; target_id: null; params: { object: NewObjectSpec; parent_id: string | null } }
  | { op: "remove_object"; target_id: string; params: Record<string, never> }
  | { op: "set_character"; target_id: string; params: { patch: CharacterPatch } }
  | { op: "set_camera"; target_id: string; params: { patch: Partial<CameraSettings> } }
  | { op: "set_light"; target_id: string; params: { patch: Partial<LightSettings> } }
  | { op: "set_environment"; target_id: null; params: { patch: Partial<EnvironmentSettings> } }
  | { op: "set_global_style"; target_id: null; params: { style: VisualStyle; color_management?: Partial<ColorManagement> } }
  | { op: "add_animation"; target_id: string; params: { clip: NewAnimationSpec } }
  | {
      op: "add_keyframe";
      target_id: string;
      params: {
        clip_id: string;
        channel: string;
        frame: number;
        value: number | Vec3 | string | boolean;
        interpolation?: Interpolation;
      };
    }
  | { op: "set_shot"; target_id: null; params: { shot: Shot } };

export type EditOpName = EditOperation["op"];

export interface CharacterPatch {
  hair?: Partial<CharacterState["hair"]>;
  wardrobe?: CharacterState["wardrobe"];
  expression?: Record<string, number>;
  pose?: Partial<RigState>;
  proportions?: Partial<CharacterState["proportions"]>;
  age_band?: CharacterState["age_band"];
}

export interface NewObjectSpec {
  name: string;
  type: ObjectType;
  transform?: Partial<Transform>;
  geometry?: GeometrySpec;
  material_id?: string | null;
  tags?: string[];
}

export interface NewAnimationSpec {
  name: string;
  kind: AnimationKind;
  start_frame: number;
  end_frame: number;
  loop?: boolean;
  source?: AnimationClip["source"];
  tracks?: Omit<AnimationTrack, "id">[];
}

export interface PlanTarget {
  object_id: string;
  name: string;
  type: ObjectType;
  reason: string;
  confidence: number;
}

export interface PreservationPolicy {
  /** Properties that must not change, e.g. ["identity", "materials", "transform"]. */
  properties: string[];
  /** Objects explicitly excluded from the edit. */
  object_ids: string[];
}

export interface EditPlan {
  id: string;
  prompt: string;
  summary: string;
  targets: PlanTarget[];
  operations: EditOperation[];
  preserve: PreservationPolicy;
  /** 0..1 planner self-assessment; below 0.5 the UI asks for confirmation. */
  confidence: number;
  warnings: string[];
  requires_confirmation: boolean;
  /** Which model produced the plan. "deterministic" is a local rule engine. */
  producer: { kind: "deterministic" | "llm" | "human"; model_id: string | null };
  estimated_cost_usd: number;
  created_at: string;
}

export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}
