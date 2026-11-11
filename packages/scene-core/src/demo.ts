import type { PbrMaterial, SceneDocument, SceneObject } from "./types.js";
import { emptyScene, makeObject } from "./defaults.js";

/**
 * A complete, deterministic scene used for seeds, tests and the "open the demo"
 * flow. It is a genuine structured scene graph: every element is an addressable
 * object with an id, so click-to-edit works on all of it.
 *
 * Prompt it was authored from:
 * "A young man enters a room, walks towards a wooden table, picks up a red apple
 *  and takes a bite."
 */

const T = (x: number, y: number, z: number, s: [number, number, number] = [1, 1, 1]) => ({
  position: [x, y, z] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: s,
});

const materials: PbrMaterial[] = [
  { id: "mat_wood_oak", name: "Old oak", base_color: "#7a5230", roughness: 0.62, metallic: 0, procedural: { id: "wood.oak", params: { grain: 0.4 } } },
  { id: "mat_plaster", name: "Plaster", base_color: "#d9d4c8", roughness: 0.9, metallic: 0 },
  { id: "mat_floor_wood", name: "Floor boards", base_color: "#5b3f28", roughness: 0.55, metallic: 0 },
  { id: "mat_apple_red", name: "Apple skin", base_color: "#a41f1f", roughness: 0.28, metallic: 0 },
  { id: "mat_skin", name: "Skin", base_color: "#c98d6b", roughness: 0.48, metallic: 0 },
  { id: "mat_hair_dark", name: "Dark hair", base_color: "#241a14", roughness: 0.42, metallic: 0 },
  { id: "mat_cotton_blue", name: "Blue cotton", base_color: "#2f4a72", roughness: 0.85, metallic: 0 },
  { id: "mat_denim", name: "Denim", base_color: "#33415c", roughness: 0.88, metallic: 0 },
  { id: "mat_leaf", name: "Leaf", base_color: "#2f6b3a", roughness: 0.7, metallic: 0 },
  { id: "mat_ceramic", name: "Ceramic pot", base_color: "#b5643c", roughness: 0.35, metallic: 0 },
  { id: "mat_eye_white", name: "Eye white", base_color: "#f2f0ec", roughness: 0.15, metallic: 0 },
  { id: "mat_iris", name: "Iris", base_color: "#3a2a1e", roughness: 0.1, metallic: 0 },
];

export function buildDemoScene(options: { now?: string } = {}): SceneDocument {
  const scene = emptyScene({
    id: "scn_demo_apple",
    projectId: "prj_demo",
    name: "Boy, table, apple",
    now: options.now ?? "2026-01-01T00:00:00.000Z",
  });
  scene.materials = materials;
  scene.settings.duration_frames = 240;
  scene.environment = {
    ...scene.environment,
    kind: "interior",
    preset_id: "room.domestic.small",
    time_of_day: "afternoon",
    global_style: "cinematic",
  };

  const objects: SceneObject[] = [
    makeObject({
      id: "env_room",
      name: "Room",
      type: "environment",
      transform: T(0, 0, 0),
      geometry: { kind: "none" },
      tags: ["environment", "interior"],
      metadata: { note: "Root of the set; walls and floor are children." },
    }),
    makeObject({
      id: "obj_floor",
      name: "Floor",
      type: "building",
      parent_id: "env_room",
      transform: T(0, -0.01, 0, [6, 0.02, 6]),
      geometry: { kind: "primitive", primitive: "plane", params: { size: 1 } },
      material_id: "mat_floor_wood",
      tags: ["surface"],
    }),
    makeObject({
      id: "obj_wall_back",
      name: "Back wall",
      type: "building",
      parent_id: "env_room",
      transform: T(0, 1.5, -3, [6, 3, 0.1]),
      geometry: { kind: "primitive", primitive: "box", params: { size: 1 } },
      material_id: "mat_plaster",
      tags: ["surface"],
    }),
    makeObject({
      id: "obj_wall_left",
      name: "Left wall",
      type: "building",
      parent_id: "env_room",
      transform: T(-3, 1.5, 0, [0.1, 3, 6]),
      geometry: { kind: "primitive", primitive: "box", params: { size: 1 } },
      material_id: "mat_plaster",
      tags: ["surface"],
    }),
    makeObject({
      id: "obj_table",
      name: "Wooden table",
      type: "furniture",
      transform: T(1.2, 0.72, -1.5),
      geometry: { kind: "primitive", primitive: "box", params: { width: 1.6, height: 0.08, depth: 0.9 } },
      material_id: "mat_wood_oak",
      tags: ["table", "wood"],
    }),
    ...[-0.6, 0.6].flatMap((dx, i) =>
      [-0.3, 0.3].map((dz, j) =>
        makeObject({
          id: `obj_table_leg_${i}${j}`,
          name: `Table leg ${i}${j}`,
          type: "furniture",
          parent_id: "obj_table",
          transform: T(dx, -0.36, dz, [0.08, 0.72, 0.08]),
          geometry: { kind: "primitive", primitive: "cylinder", params: { radius: 0.04, depth: 1 } },
          material_id: "mat_wood_oak",
          tags: ["table", "leg"],
        }),
      ),
    ),
    makeObject({
      id: "obj_apple",
      name: "Red apple",
      type: "prop",
      transform: T(1.15, 0.8, -1.45, [1, 1, 1]),
      geometry: { kind: "primitive", primitive: "sphere", params: { radius: 0.045 } },
      material_id: "mat_apple_red",
      tags: ["fruit", "prop", "grab_target"],
      metadata: { graspable: true },
    }),
    makeObject({
      id: "obj_plant",
      name: "Potted plant",
      type: "plant",
      transform: T(-2.3, 0, -2.2),
      geometry: { kind: "procedural", generator: "plant.potted", params: { leaves: 9 } },
      material_id: "mat_leaf",
      tags: ["vegetation", "decor"],
    }),
    makeObject({
      id: "obj_pot",
      name: "Plant pot",
      type: "prop",
      parent_id: "obj_plant",
      transform: T(0, 0.14, 0, [0.28, 0.28, 0.28]),
      geometry: { kind: "primitive", primitive: "cylinder", params: { radius: 0.16, depth: 0.28 } },
      material_id: "mat_ceramic",
      tags: ["decor"],
    }),
    /* ---------------- character hierarchy ---------------- */
    makeObject({
      id: "chr_boy",
      name: "Character_Boy",
      type: "character",
      transform: T(-2.4, 0, 1.4),
      geometry: { kind: "asset", asset_id: "asset_base_male_rig", format: "glb" },
      material_id: "mat_skin",
      tags: ["character", "hero"],
      character: {
        identity_id: "ident_boy_01",
        profile_id: null,
        age_band: "adult",
        expression: { mouth_smile: 0.15, brow_neutral: 1 },
        pose: { rig_id: "rig_humanoid_m", bone_rotations: {}, bone_translations: {}, ik_targets: {} },
        hair: { style_id: "hair.short_tousled", color: "#241a14", length_cm: 6 },
        wardrobe: [
          { garment_id: "garment.tshirt", color: "#2f4a72", material_id: "mat_cotton_blue" },
          { garment_id: "garment.jeans", color: "#33415c", material_id: "mat_denim" },
        ],
        proportions: { height_m: 1.78, head_ratio: 7.5, build: "average" },
        identity_locked: ["identity_id", "proportions.height_m", "hair.color"],
      },
    }),
    makeObject({
      id: "chr_boy_head",
      name: "Head",
      type: "body_part",
      parent_id: "chr_boy",
      transform: T(0, 1.62, 0),
      geometry: { kind: "primitive", primitive: "sphere", params: { radius: 0.105 } },
      material_id: "mat_skin",
      tags: ["body_part", "head"],
    }),
    makeObject({
      id: "chr_boy_face",
      name: "Face",
      type: "body_part",
      parent_id: "chr_boy_head",
      transform: T(0, -0.01, 0.085),
      geometry: { kind: "procedural", generator: "face.features", params: {} },
      material_id: "mat_skin",
      tags: ["body_part", "face"],
    }),
    makeObject({
      id: "chr_boy_eyes",
      name: "Eyes",
      type: "body_part",
      parent_id: "chr_boy_head",
      transform: T(0, 0.02, 0.09),
      geometry: { kind: "primitive", primitive: "sphere", params: { radius: 0.014 } },
      material_id: "mat_eye_white",
      tags: ["body_part", "eyes"],
    }),
    makeObject({
      id: "chr_boy_hair",
      name: "Hair",
      type: "body_part",
      parent_id: "chr_boy_head",
      transform: T(0, 0.045, 0),
      geometry: { kind: "procedural", generator: "hair.card", params: { strands: 900 } },
      material_id: "mat_hair_dark",
      tags: ["body_part", "hair"],
    }),
    makeObject({
      id: "chr_boy_body",
      name: "Body",
      type: "body_part",
      parent_id: "chr_boy",
      transform: T(0, 1.15, 0),
      geometry: { kind: "primitive", primitive: "capsule", params: { radius: 0.16, length: 0.55 } },
      material_id: "mat_cotton_blue",
      tags: ["body_part", "torso"],
    }),
    makeObject({
      id: "chr_boy_arm_l",
      name: "Left_Arm",
      type: "body_part",
      parent_id: "chr_boy",
      transform: T(-0.22, 1.32, 0),
      geometry: { kind: "primitive", primitive: "capsule", params: { radius: 0.05, length: 0.6 } },
      material_id: "mat_skin",
      tags: ["body_part", "arm", "left"],
    }),
    makeObject({
      id: "chr_boy_arm_r",
      name: "Right_Arm",
      type: "body_part",
      parent_id: "chr_boy",
      transform: T(0.22, 1.32, 0),
      geometry: { kind: "primitive", primitive: "capsule", params: { radius: 0.05, length: 0.6 } },
      material_id: "mat_skin",
      tags: ["body_part", "arm", "right"],
    }),
    makeObject({
      id: "chr_boy_hand_r",
      name: "Right_Hand",
      type: "body_part",
      parent_id: "chr_boy_arm_r",
      transform: T(0, -0.62, 0),
      geometry: { kind: "primitive", primitive: "sphere", params: { radius: 0.05 } },
      material_id: "mat_skin",
      tags: ["body_part", "hand", "right", "grasp_socket"],
    }),
    makeObject({
      id: "chr_boy_legs",
      name: "Legs",
      type: "body_part",
      parent_id: "chr_boy",
      transform: T(0, 0.44, 0),
      geometry: { kind: "primitive", primitive: "capsule", params: { radius: 0.07, length: 0.86 } },
      material_id: "mat_denim",
      tags: ["body_part", "legs"],
    }),
    makeObject({
      id: "chr_boy_clothing",
      name: "Clothing",
      type: "body_part",
      parent_id: "chr_boy_body",
      transform: T(0, 0, 0),
      geometry: { kind: "procedural", generator: "garment.tshirt", params: { fit: "regular" } },
      material_id: "mat_cotton_blue",
      tags: ["body_part", "clothing", "shirt"],
    }),
    /* ---------------- cameras, lights, audio, fx ---------------- */
    makeObject({
      id: "cam_main",
      name: "Camera_Main",
      type: "camera",
      transform: { position: [0.2, 1.55, 3.4], rotation: [-0.12, 0.05, 0], scale: [1, 1, 1] },
      geometry: { kind: "none" },
      tags: ["camera", "hero"],
      camera: {
        focal_length_mm: 35,
        sensor_width_mm: 36,
        fstop: 2.8,
        focus_distance_m: 3.2,
        dof_enabled: true,
        projection: "perspective",
        shot_type: "medium",
        movement: "dolly",
        movement_params: { distance_m: 0.8, ease: 1 },
      },
    }),
    makeObject({
      id: "cam_close",
      name: "Camera_CloseUp",
      type: "camera",
      transform: { position: [1.05, 1.15, -0.35], rotation: [0.05, 2.9, 0], scale: [1, 1, 1] },
      geometry: { kind: "none" },
      tags: ["camera", "insert"],
      camera: {
        focal_length_mm: 85,
        sensor_width_mm: 36,
        fstop: 1.8,
        focus_distance_m: 0.9,
        dof_enabled: true,
        projection: "perspective",
        shot_type: "close_up",
        movement: "static",
        movement_params: {},
      },
    }),
    makeObject({
      id: "lgt_key",
      name: "Key light",
      type: "light",
      transform: T(-1.6, 2.4, 1.2),
      geometry: { kind: "none" },
      tags: ["light", "key"],
      light: { kind: "area", intensity_watts: 220, color: "#ffe9c9", direction: [0.3, -1, -0.4], size_m: 1.2, shadows: true, softness: 0.6, color_temperature_k: 4300, role: "key" },
    }),
    makeObject({
      id: "lgt_fill",
      name: "Fill light",
      type: "light",
      transform: T(2.2, 1.8, 1.6),
      geometry: { kind: "none" },
      tags: ["light", "fill"],
      light: { kind: "area", intensity_watts: 60, color: "#cfe0ff", direction: [-0.5, -0.6, -0.6], size_m: 2, shadows: false, softness: 0.9, color_temperature_k: 6500, role: "fill" },
    }),
    makeObject({
      id: "lgt_window",
      name: "Window light",
      type: "light",
      transform: T(-2.9, 1.8, -0.4),
      geometry: { kind: "none" },
      tags: ["light", "practical"],
      light: { kind: "sun", intensity_watts: 4, color: "#fff3dd", direction: [0.85, -0.5, 0.2], shadows: true, softness: 0.25, color_temperature_k: 5200, role: "practical" },
    }),
    makeObject({
      id: "aud_score",
      name: "Score",
      type: "audio",
      transform: T(0, 0, 0),
      geometry: { kind: "none" },
      tags: ["audio", "music"],
      audio: {
        kind: "music",
        asset_id: null,
        gain_db: -18,
        start_frame: 0,
        end_frame: 240,
        loop: true,
        licence_note: "Placeholder slot - a licensed track must be attached before export.",
      },
    }),
    makeObject({
      id: "fx_dust",
      name: "Dust motes",
      type: "particles",
      transform: T(0, 1.4, 0),
      geometry: { kind: "none" },
      tags: ["fx", "atmosphere"],
      particles: { emitter_shape: "box", emitter_params: { size: 4 }, rate: 40, lifetime_frames: 120, system: "dust", params: { size: 0.01 } },
    }),
  ];

  scene.objects = objects;
  scene.active_camera_id = "cam_main";

  scene.animations = [
    {
      id: "anim_boy_walk",
      name: "Walk to table",
      target_id: "chr_boy",
      kind: "transform",
      start_frame: 0,
      end_frame: 96,
      loop: false,
      source: { kind: "manual", model_id: null },
      tracks: [
        {
          id: "trk_walk_pos",
          channel: "transform.position",
          keyframes: [
            { id: "kf_0", frame: 0, value: [-2.4, 0, 1.4], interpolation: "bezier" },
            { id: "kf_1", frame: 96, value: [0.45, 0, -0.85], interpolation: "bezier" },
          ],
        },
        {
          id: "trk_walk_rot",
          channel: "transform.rotation",
          keyframes: [
            { id: "kf_2", frame: 0, value: [0, 0, 0], interpolation: "linear" },
            { id: "kf_3", frame: 96, value: [0, 2.95, 0], interpolation: "linear" },
          ],
        },
      ],
    },
    {
      id: "anim_boy_reach",
      name: "Reach for apple",
      target_id: "chr_boy_arm_r",
      kind: "pose",
      start_frame: 96,
      end_frame: 132,
      loop: false,
      source: { kind: "manual", model_id: null },
      tracks: [
        {
          id: "trk_reach",
          channel: "pose.bone.upper_arm_r.rotation",
          keyframes: [
            { id: "kf_4", frame: 96, value: [0, 0, 0], interpolation: "bezier" },
            { id: "kf_5", frame: 132, value: [-1.15, 0.1, 0.2], interpolation: "bezier" },
          ],
        },
      ],
    },
    {
      id: "anim_apple_pickup",
      name: "Apple leaves the table",
      target_id: "obj_apple",
      kind: "transform",
      start_frame: 132,
      end_frame: 168,
      loop: false,
      source: { kind: "manual", model_id: null },
      tracks: [
        {
          id: "trk_apple_pos",
          channel: "transform.position",
          keyframes: [
            { id: "kf_6", frame: 132, value: [1.15, 0.8, -1.45], interpolation: "bezier" },
            { id: "kf_7", frame: 168, value: [0.5, 1.28, -0.9], interpolation: "bezier" },
          ],
        },
      ],
    },
  ];

  scene.shots = [
    { id: "shot_1", index: 0, name: "Establishing", camera_id: "cam_main", start_frame: 0, end_frame: 48, description: "Wide of the room; the boy enters from the left.", subjects: ["chr_boy", "obj_table"], transition_in: "fade" },
    { id: "shot_2", index: 1, name: "Approach", camera_id: "cam_main", start_frame: 48, end_frame: 132, description: "Dolly with the boy as he walks to the table.", subjects: ["chr_boy", "obj_table", "obj_apple"], transition_in: "cut" },
    { id: "shot_3", index: 2, name: "Pickup insert", camera_id: "cam_close", start_frame: 132, end_frame: 168, description: "Close on the hand taking the apple.", subjects: ["obj_apple", "chr_boy_hand_r"], transition_in: "cut" },
    { id: "shot_4", index: 3, name: "The bite", camera_id: "cam_close", start_frame: 168, end_frame: 240, description: "Close-up as he bites into the apple.", subjects: ["chr_boy", "obj_apple"], transition_in: "cut" },
  ];

  return scene;
}
