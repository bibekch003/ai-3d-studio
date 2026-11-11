import { emptyScene } from "./defaults.js";
import { planScene, type ScenePlan } from "./director.js";
import { newId } from "./ids.js";
import { validateScene } from "./schema.js";
import type {
  PbrMaterial,
  SceneDocument,
  SceneObject,
  Shot,
  Transform,
  Vec3,
} from "./types.js";

/**
 * Builds a complete, editable scene from a written description.
 *
 * This is the "describe a scene and get a scene" path: the Director's plan is
 * turned into real objects (set, cast, props, lights, cameras, shots, clips) so
 * the studio never has to fall back to a hard-coded demo. Everything it creates
 * is an ordinary scene object, addressable and editable like any other.
 */

const T = (position: Vec3, scale: Vec3 = [1, 1, 1]): Transform => ({
  position,
  rotation: [0, 0, 0],
  scale,
});

function materials(): PbrMaterial[] {
  return [
    { id: "mat_wood_oak", name: "Old oak", base_color: "#7a5230", roughness: 0.62, metallic: 0 },
    { id: "mat_plaster", name: "Plaster", base_color: "#d9d4c8", roughness: 0.9, metallic: 0 },
    { id: "mat_floor", name: "Floor boards", base_color: "#5b3f28", roughness: 0.55, metallic: 0 },
    { id: "mat_skin", name: "Skin", base_color: "#c98d6b", roughness: 0.48, metallic: 0 },
    { id: "mat_hair", name: "Dark hair", base_color: "#241a14", roughness: 0.42, metallic: 0 },
    { id: "mat_cloth", name: "Cotton", base_color: "#2f4a72", roughness: 0.85, metallic: 0 },
    { id: "mat_denim", name: "Denim", base_color: "#33415c", roughness: 0.88, metallic: 0 },
    { id: "mat_apple", name: "Apple skin", base_color: "#a41f1f", roughness: 0.28, metallic: 0 },
    { id: "mat_prop", name: "Prop surface", base_color: "#8a8f98", roughness: 0.6, metallic: 0 },
    { id: "mat_leaf", name: "Leaf", base_color: "#2f6b3a", roughness: 0.7, metallic: 0 },
    { id: "mat_ground", name: "Ground", base_color: "#4b5a3f", roughness: 0.95, metallic: 0 },
  ];
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24) || "object";
}

function baseObject(
  id: string,
  name: string,
  type: SceneObject["type"],
  transform: Transform,
  extra: Partial<SceneObject> = {},
): SceneObject {
  return {
    id,
    name,
    type,
    parent_id: extra.parent_id ?? null,
    transform,
    geometry: extra.geometry ?? { kind: "none" },
    material_id: extra.material_id ?? null,
    material_overrides: null,
    texture_refs: [],
    animation_refs: [],
    visible: true,
    locked: false,
    protected: false,
    tags: extra.tags ?? [],
    version: 1,
    metadata: extra.metadata ?? {},
    ...(extra.character ? { character: extra.character } : {}),
    ...(extra.camera ? { camera: extra.camera } : {}),
    ...(extra.light ? { light: extra.light } : {}),
  };
}

/** A rigged-looking placeholder character with the full editable hierarchy. */
function characterCluster(idPrefix: string, name: string, at: Vec3, ageBand: "child" | "teen" | "adult" | "senior" | "unspecified"): SceneObject[] {
  const height = ageBand === "child" ? 1.15 : ageBand === "teen" ? 1.62 : ageBand === "senior" ? 1.68 : 1.78;
  const s = height / 1.78;
  return [
    baseObject(idPrefix, name, "character", T(at), {
      geometry: { kind: "asset", asset_id: "asset_base_male_rig", format: "glb" },
      material_id: "mat_skin",
      tags: ["character", "cast"],
      character: {
        identity_id: `ident_${slug(name)}`,
        profile_id: null,
        age_band: ageBand,
        expression: { mouth_smile: 0.1, brow_neutral: 1 },
        pose: { rig_id: "rig_humanoid_m", bone_rotations: {}, bone_translations: {}, ik_targets: {} },
        hair: { style_id: "hair.short_tousled", color: "#241a14", length_cm: 6 },
        wardrobe: [
          { garment_id: "garment.tshirt", color: "#2f4a72", material_id: "mat_cloth" },
          { garment_id: "garment.jeans", color: "#33415c", material_id: "mat_denim" },
        ],
        proportions: { height_m: height, head_ratio: 7.5, build: "average" },
        identity_locked: ["identity_id", "proportions.height_m"],
      },
    }),
    baseObject(`${idPrefix}_head`, "Head", "body_part", T([0, 0.91 * height, 0], [s, s, s]), {
      parent_id: idPrefix,
      geometry: { kind: "primitive", primitive: "sphere", params: { radius: 0.105 } },
      material_id: "mat_skin",
      tags: ["body_part", "head"],
    }),
    baseObject(`${idPrefix}_hair`, "Hair", "body_part", T([0, 0.955 * height, 0], [s, s, s]), {
      parent_id: `${idPrefix}_head`,
      geometry: { kind: "procedural", generator: "hair.card", params: { strands: 700 } },
      material_id: "mat_hair",
      tags: ["body_part", "hair"],
    }),
    baseObject(`${idPrefix}_body`, "Body", "body_part", T([0, 0.65 * height, 0], [s, s, s]), {
      parent_id: idPrefix,
      geometry: { kind: "primitive", primitive: "capsule", params: { radius: 0.16, length: 0.55 } },
      material_id: "mat_cloth",
      tags: ["body_part", "torso"],
    }),
    baseObject(`${idPrefix}_arm_r`, "Right_Arm", "body_part", T([0.22 * s, 0.74 * height, 0], [s, s, s]), {
      parent_id: idPrefix,
      geometry: { kind: "primitive", primitive: "capsule", params: { radius: 0.05, length: 0.6 } },
      material_id: "mat_skin",
      tags: ["body_part", "arm", "right"],
    }),
    baseObject(`${idPrefix}_hand_r`, "Right_Hand", "body_part", T([0, -0.62, 0], [s, s, s]), {
      parent_id: `${idPrefix}_arm_r`,
      geometry: { kind: "primitive", primitive: "sphere", params: { radius: 0.05 } },
      material_id: "mat_skin",
      tags: ["body_part", "hand", "right", "grasp_socket"],
    }),
    baseObject(`${idPrefix}_legs`, "Legs", "body_part", T([0, 0.25 * height, 0], [s, s, s]), {
      parent_id: idPrefix,
      geometry: { kind: "primitive", primitive: "capsule", params: { radius: 0.07, length: 0.86 } },
      material_id: "mat_denim",
      tags: ["body_part", "legs"],
    }),
  ];
}

function propGeometry(name: string): SceneObject["geometry"] {
  const key = slug(name);
  if (key.includes("apple")) return { kind: "primitive", primitive: "sphere", params: { radius: 0.045 } };
  if (key.includes("cup") || key.includes("mug")) return { kind: "primitive", primitive: "cylinder", params: { radius: 0.045, depth: 0.1 } };
  if (key.includes("bottle")) return { kind: "primitive", primitive: "cylinder", params: { radius: 0.04, depth: 0.24 } };
  if (key.includes("book") || key.includes("letter")) return { kind: "primitive", primitive: "box", params: { width: 0.18, height: 0.03, depth: 0.24 } };
  if (key.includes("phone")) return { kind: "primitive", primitive: "box", params: { width: 0.07, height: 0.01, depth: 0.14 } };
  if (key.includes("door")) return { kind: "primitive", primitive: "box", params: { width: 0.9, height: 2.0, depth: 0.06 } };
  if (key.includes("key")) return { kind: "primitive", primitive: "torus", params: { radius: 0.02, tube: 0.004 } };
  return { kind: "primitive", primitive: "box", params: { width: 0.12, height: 0.12, depth: 0.12 } };
}

function propMaterial(name: string): string {
  const key = slug(name);
  if (key.includes("apple")) return "mat_apple";
  if (key.includes("book") || key.includes("letter")) return "mat_wood_oak";
  return "mat_prop";
}

export interface BuildFromPromptResult {
  scene: SceneDocument;
  plan: ScenePlan;
  warnings: string[];
}

/**
 * `buildSceneFromPrompt("a girl opens a door in a forest at night")` returns a
 * scene whose objects are all individually editable. Deterministic: the same
 * prompt produces the same ids, so tests and diffs are stable.
 */
export function buildSceneFromPrompt(
  prompt: string,
  options: { now?: string; fps?: 24 | 25 | 30 | 60; seconds?: number; projectId?: string } = {},
): BuildFromPromptResult {
  const plan = planScene(prompt, { fps: options.fps ?? 24, seconds: options.seconds ?? 10, now: options.now });
  const scene = emptyScene({
    projectId: options.projectId ?? newId("prj"),
    name: prompt.length > 48 ? `${prompt.slice(0, 45)}…` : prompt,
    now: options.now,
  });

  scene.settings.fps = (options.fps ?? 24) as SceneDocument["settings"]["fps"];
  scene.settings.duration_frames = Math.max(48, plan.total_frames);
  scene.materials = materials();
  scene.environment = {
    ...scene.environment,
    kind: plan.environment.kind,
    preset_id: plan.environment.preset_id,
    time_of_day: plan.environment.time_of_day as SceneDocument["environment"]["time_of_day"],
    global_style: plan.style,
    sky: {
      kind: "procedural",
      hdri_asset_id: null,
      color: plan.environment.time_of_day === "night" ? "#0b1224" : plan.environment.time_of_day === "sunset" ? "#f4a261" : "#9fb7d4",
    },
    vegetation_density: plan.environment.kind === "exterior" ? 0.6 : 0,
  };

  const objects: SceneObject[] = [];
  const interior = plan.environment.kind === "interior";

  // --- set -----------------------------------------------------------------
  objects.push(baseObject("env_set", interior ? "Room" : "Location", "environment", T([0, 0, 0]), { tags: ["environment"] }));
  objects.push(
    baseObject("obj_floor", "Floor", "building", T([0, -0.01, 0], [8, 0.02, 8]), {
      parent_id: "env_set",
      geometry: { kind: "primitive", primitive: "plane", params: { size: 1 } },
      material_id: interior ? "mat_floor" : "mat_ground",
      tags: ["surface"],
    }),
  );
  if (interior) {
    objects.push(
      baseObject("obj_wall_back", "Back wall", "building", T([0, 1.5, -3.2], [8, 3, 0.1]), {
        parent_id: "env_set",
        geometry: { kind: "primitive", primitive: "box", params: { size: 1 } },
        material_id: "mat_plaster",
        tags: ["surface"],
      }),
    );
    objects.push(
      baseObject("obj_wall_left", "Left wall", "building", T([-3.2, 1.5, 0], [0.1, 3, 8]), {
        parent_id: "env_set",
        geometry: { kind: "primitive", primitive: "box", params: { size: 1 } },
        material_id: "mat_plaster",
        tags: ["surface"],
      }),
    );
  }

  // --- table (only when the prompt implies one) ----------------------------
  const wantsTable = /\b(table|desk|counter)\b/i.test(prompt) || plan.props.some((p) => /cup|mug|apple|book|bottle|key|letter/i.test(p.name));
  if (wantsTable) {
    objects.push(
      baseObject("obj_table", "Table", "furniture", T([0.9, 0.72, -1.4]), {
        geometry: { kind: "primitive", primitive: "box", params: { width: 1.5, height: 0.08, depth: 0.8 } },
        material_id: "mat_wood_oak",
        tags: ["table", "wood"],
      }),
    );
    objects.push(
      baseObject("obj_table_leg", "Table leg", "furniture", T([0, -0.36, 0], [0.08, 0.72, 0.08]), {
        parent_id: "obj_table",
        geometry: { kind: "primitive", primitive: "cylinder", params: { radius: 0.04, depth: 1 } },
        material_id: "mat_wood_oak",
        tags: ["table", "leg"],
      }),
    );
  }

  // --- props ---------------------------------------------------------------
  plan.props.forEach((prop, index) => {
    const id = `obj_${slug(prop.name)}`;
    const restingY = wantsTable ? 0.78 : 0.06;
    objects.push(
      baseObject(id, prop.name, "prop", T([0.9 - index * 0.35, restingY, wantsTable ? -1.4 : -0.6]), {
        geometry: propGeometry(prop.name),
        material_id: propMaterial(prop.name),
        tags: ["prop", slug(prop.name), "plan"],
        metadata: { interaction: prop.interaction, graspable: true },
      }),
    );
  });

  if (plan.environment.kind === "exterior" && /forest|tree/i.test(prompt)) {
    objects.push(
      baseObject("obj_tree", "Tree", "plant", T([-2.6, 0, -2.4]), {
        geometry: { kind: "procedural", generator: "plant.tree", params: { leaves: 240 } },
        material_id: "mat_leaf",
        tags: ["vegetation"],
      }),
    );
  }

  // --- cast ----------------------------------------------------------------
  const lead = plan.characters[0]!;
  const leadId = "chr_lead";
  const startX = interior ? -2.6 : -1.8;
  objects.push(...characterCluster(leadId, lead.name.replace(/_/g, " "), [startX, 0, 1.3], lead.age_band));
  plan.characters.slice(1).forEach((extra, index) => {
    objects.push(
      ...characterCluster(`chr_extra_${index + 1}`, extra.name.replace(/_/g, " "), [startX + 1.2 + index * 0.8, 0, 2.0], extra.age_band),
    );
  });

  // --- lights --------------------------------------------------------------
  const night = plan.environment.time_of_day === "night" || plan.environment.time_of_day === "dusk";
  const sunset = plan.environment.time_of_day === "sunset" || plan.environment.time_of_day === "dawn";
  objects.push(
    baseObject("lgt_key", "Key light", "light", T([-1.8, 2.6, 1.4]), {
      geometry: { kind: "none" },
      tags: ["light", "key"],
      light: {
        kind: "area",
        intensity_watts: night ? 45 : sunset ? 170 : 220,
        color: night ? "#8fa8ff" : sunset ? "#ffb066" : "#ffe9c9",
        direction: [0.3, -1, -0.4],
        size_m: 1.2,
        shadows: true,
        softness: 0.55,
        color_temperature_k: night ? 7000 : sunset ? 2900 : 4300,
        role: "key",
      },
    }),
  );
  objects.push(
    baseObject("lgt_fill", "Fill light", "light", T([2.4, 1.9, 1.8]), {
      geometry: { kind: "none" },
      tags: ["light", "fill"],
      light: {
        kind: "area",
        intensity_watts: night ? 12 : 55,
        color: night ? "#5f78ff" : "#cfe0ff",
        direction: [-0.5, -0.6, -0.6],
        size_m: 2,
        shadows: false,
        softness: 0.9,
        color_temperature_k: 6500,
        role: "fill",
      },
    }),
  );
  objects.push(
    baseObject("lgt_rim", "Rim light", "light", T([0.4, 2.2, -3.0]), {
      geometry: { kind: "none" },
      tags: ["light", "rim"],
      light: {
        kind: "spot",
        intensity_watts: night ? 60 : 90,
        color: "#ffffff",
        direction: [0, -0.6, 1],
        angle_deg: 40,
        shadows: true,
        softness: 0.4,
        color_temperature_k: 5600,
        role: "rim",
      },
    }),
  );

  // --- cameras -------------------------------------------------------------
  objects.push(
    baseObject("cam_main", "Camera_Main", "camera", {
      position: [0.4, 1.55, 4.2],
      rotation: [-0.1, 0.03, 0],
      scale: [1, 1, 1],
    }, {
      geometry: { kind: "none" },
      tags: ["camera", "hero"],
      camera: {
        focal_length_mm: 35,
        sensor_width_mm: 36,
        fstop: 2.8,
        focus_distance_m: 3.4,
        dof_enabled: true,
        projection: "perspective",
        shot_type: "medium",
        movement: "dolly",
        movement_params: { distance_m: 0.6 },
      },
    }),
  );
  objects.push(
    baseObject("cam_insert", "Camera_Insert", "camera", {
      position: [0.9, 1.25, 0.1],
      rotation: [0.05, 2.9, 0],
      scale: [1, 1, 1],
    }, {
      geometry: { kind: "none" },
      tags: ["camera", "insert"],
      camera: {
        focal_length_mm: 85,
        sensor_width_mm: 36,
        fstop: 1.8,
        focus_distance_m: 1.1,
        dof_enabled: true,
        projection: "perspective",
        shot_type: "close_up",
        movement: "static",
        movement_params: {},
      },
    }),
  );

  scene.objects = objects;
  scene.active_camera_id = "cam_main";

  // --- shots ---------------------------------------------------------------
  scene.shots = plan.shots.map<Shot>((shot, index) => ({
    id: `shot_${index + 1}`,
    index,
    name: shot.name,
    camera_id: shot.camera_shot_type === "close_up" || shot.camera_shot_type === "extreme_close_up" ? "cam_insert" : "cam_main",
    start_frame: shot.start_frame,
    end_frame: Math.min(shot.end_frame, scene.settings.duration_frames),
    description: shot.description,
    subjects: [leadId, ...plan.props.map((p) => `obj_${slug(p.name)}`)],
    transition_in: index === 0 ? "fade" : "cut",
  }));

  // --- animation: entrance + interaction -----------------------------------
  const firstProp = plan.props[0];
  const walkEnd = scene.shots[1]?.end_frame ?? Math.round(scene.settings.duration_frames * 0.45);
  const targetX = wantsTable ? 0.35 : 0;

  scene.animations = [
    {
      id: "anim_entrance",
      name: "Entrance",
      target_id: leadId,
      kind: "transform",
      start_frame: 0,
      end_frame: walkEnd,
      loop: false,
      source: { kind: "ai", model_id: "local.rule-engine", prompt },
      tracks: [
        {
          id: "trk_entrance_pos",
          channel: "transform.position",
          keyframes: [
            { id: "kf_in_0", frame: 0, value: [startX, 0, 1.3], interpolation: "bezier" },
            { id: "kf_in_1", frame: walkEnd, value: [targetX, 0, 0.2], interpolation: "bezier" },
          ],
        },
        {
          id: "trk_entrance_rot",
          channel: "transform.rotation",
          keyframes: [
            { id: "kf_in_2", frame: 0, value: [0, 0, 0], interpolation: "linear" },
            { id: "kf_in_3", frame: walkEnd, value: [0, 0.4, 0], interpolation: "linear" },
          ],
        },
      ],
    },
  ];

  if (firstProp && /pick|grab|take|bite|open|read/i.test(`${prompt} ${firstProp.interaction}`)) {
    const propId = `obj_${slug(firstProp.name)}`;
    const pickStart = walkEnd;
    const pickEnd = Math.min(scene.settings.duration_frames, walkEnd + 36);
    scene.animations.push(
      {
        id: "anim_reach",
        name: "Reach",
        target_id: `${leadId}_arm_r`,
        kind: "pose",
        start_frame: pickStart,
        end_frame: pickEnd,
        loop: false,
        source: { kind: "ai", model_id: "local.rule-engine", prompt },
        tracks: [
          {
            id: "trk_reach",
            channel: "pose.bone.upper_arm_r.rotation",
            keyframes: [
              { id: "kf_reach_0", frame: pickStart, value: [0, 0, 0], interpolation: "bezier" },
              { id: "kf_reach_1", frame: pickEnd, value: [-1.1, 0.15, 0.2], interpolation: "bezier" },
            ],
          },
        ],
      },
      {
        id: "anim_prop_pickup",
        name: `${firstProp.name} picked up`,
        target_id: propId,
        kind: "transform",
        start_frame: pickStart,
        end_frame: pickEnd,
        loop: false,
        source: { kind: "ai", model_id: "local.rule-engine", prompt },
        tracks: [
          {
            id: "trk_prop_pos",
            channel: "transform.position",
            keyframes: [
              { id: "kf_prop_0", frame: pickStart, value: [0.9, wantsTable ? 0.78 : 0.06, wantsTable ? -1.4 : -0.6], interpolation: "bezier" },
              { id: "kf_prop_1", frame: pickEnd, value: [0.45, 1.25, 0.15], interpolation: "bezier" },
            ],
          },
        ],
      },
    );
    const propObject = scene.objects.find((o) => o.id === propId);
    if (propObject) propObject.animation_refs = ["anim_prop_pickup"];
  }

  const leadObject = scene.objects.find((o) => o.id === leadId);
  if (leadObject) leadObject.animation_refs = ["anim_entrance"];

  const validation = validateScene(scene);
  const warnings = [...plan.warnings, ...validation.errors.map((e) => `Scene validation: ${e.message}`)];
  return { scene, plan, warnings };
}

/** An empty stage: floor, three-point light, camera. No characters, no props. */
export function buildBlankScene(options: { now?: string; name?: string } = {}): SceneDocument {
  const scene = emptyScene({ name: options.name ?? "Untitled scene", now: options.now });
  scene.materials = materials();
  scene.settings.duration_frames = 240;
  scene.objects = [
    baseObject("env_set", "Stage", "environment", T([0, 0, 0]), { tags: ["environment"] }),
    baseObject("obj_floor", "Floor", "building", T([0, -0.01, 0], [8, 0.02, 8]), {
      parent_id: "env_set",
      geometry: { kind: "primitive", primitive: "plane", params: { size: 1 } },
      material_id: "mat_floor",
      tags: ["surface"],
    }),
    baseObject("lgt_key", "Key light", "light", T([-1.8, 2.6, 1.4]), {
      light: {
        kind: "area",
        intensity_watts: 220,
        color: "#ffe9c9",
        direction: [0.3, -1, -0.4],
        size_m: 1.2,
        shadows: true,
        softness: 0.55,
        color_temperature_k: 4300,
        role: "key",
      },
    }),
    baseObject("lgt_fill", "Fill light", "light", T([2.4, 1.9, 1.8]), {
      light: {
        kind: "area",
        intensity_watts: 55,
        color: "#cfe0ff",
        direction: [-0.5, -0.6, -0.6],
        size_m: 2,
        shadows: false,
        softness: 0.9,
        color_temperature_k: 6500,
        role: "fill",
      },
    }),
    baseObject("cam_main", "Camera_Main", "camera", { position: [0.4, 1.55, 4.2], rotation: [-0.1, 0, 0], scale: [1, 1, 1] }, {
      camera: {
        focal_length_mm: 35,
        sensor_width_mm: 36,
        fstop: 2.8,
        focus_distance_m: 3.4,
        dof_enabled: true,
        projection: "perspective",
        shot_type: "medium",
        movement: "static",
        movement_params: {},
      },
    }),
  ];
  scene.active_camera_id = "cam_main";
  scene.shots = [
    {
      id: "shot_1",
      index: 0,
      name: "Wide",
      camera_id: "cam_main",
      start_frame: 0,
      end_frame: scene.settings.duration_frames,
      description: "Empty stage, three-point lighting.",
      subjects: [],
      transition_in: "fade",
    },
  ];
  return scene;
}
