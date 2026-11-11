import type {
  EditOperation,
  EditPlan,
  ObjectType,
  PreservationPolicy,
  SceneDocument,
  ValidationIssue,
} from "./types.js";
import { indexScene } from "./scene.js";

const ALL_OPS = [
  "set_transform",
  "set_material",
  "set_geometry_param",
  "replace_geometry",
  "set_visibility",
  "set_locked",
  "rename",
  "reparent",
  "add_object",
  "remove_object",
  "set_character",
  "set_camera",
  "set_light",
  "set_environment",
  "set_global_style",
  "add_animation",
  "add_keyframe",
  "set_shot",
] as const;

/** Which object type an operation may target. `null` = scene-level. */
export const OP_TARGET_TYPES: Record<string, ObjectType[] | null> = {
  set_transform: null, // any object
  set_material: null,
  set_geometry_param: null,
  replace_geometry: null,
  set_visibility: null,
  set_locked: null,
  rename: null,
  reparent: null,
  add_object: [],
  remove_object: null,
  set_character: ["character"],
  set_camera: ["camera"],
  set_light: ["light"],
  set_environment: [],
  set_global_style: [],
  add_animation: null,
  add_keyframe: null,
  set_shot: [],
};

/** Types that may be created by an AI plan without extra settings payloads. */
export const CREATABLE_TYPES: ObjectType[] = [
  "prop",
  "furniture",
  "plant",
  "vehicle",
  "building",
  "group",
  "particles",
  "audio",
  "environment",
  "body_part",
];

/** Properties a preservation policy can protect. */
export const PROTECTABLE_PROPERTIES = [
  "identity",
  "face",
  "hair",
  "materials",
  "transform",
  "position",
  "animation",
  "camera",
  "lighting",
  "environment",
  "hierarchy",
] as const;

const OP_PROPERTY_MAP: Record<string, string> = {
  set_material: "materials",
  set_transform: "transform",
  set_camera: "camera",
  set_light: "lighting",
  set_environment: "environment",
  reparent: "hierarchy",
  add_animation: "animation",
  add_keyframe: "animation",
};

/**
 * Which preservation promises an operation would break.
 *
 * Character edits are checked per attribute so that "change his hairstyle but
 * preserve his face" is expressible: hair is not face, and neither is identity.
 */
export function preservationConflicts(op: EditOperation, policy: Partial<PreservationPolicy> | undefined): string[] {
  const keep = new Set(policy?.properties ?? []);
  if (keep.size === 0) return [];

  if (op.op === "set_character") {
    const broken = new Set<string>();
    const patch = op.params.patch ?? {};
    if (patch.hair) {
      if (keep.has("hair")) broken.add("hair");
      if (keep.has("identity")) broken.add("identity");
    }
    if (patch.expression) {
      if (keep.has("face")) broken.add("face");
      if (keep.has("identity")) broken.add("identity");
    }
    if (patch.proportions || patch.age_band) {
      if (keep.has("identity")) broken.add("identity");
    }
    if (patch.wardrobe && keep.has("identity")) broken.add("identity");
    return [...broken];
  }

  const mapped = OP_PROPERTY_MAP[op.op];
  return mapped && keep.has(mapped) ? [mapped] : [];
}

export interface PlanValidation {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** Objects the plan would touch, resolved for the confirmation UI. */
  affected: { object_id: string; name: string; type: ObjectType; changes: string[] }[];
}

export function validatePreservation(policy: Partial<PreservationPolicy> | undefined): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!policy) return issues;
  for (const prop of policy.properties ?? []) {
    if (!(PROTECTABLE_PROPERTIES as readonly string[]).includes(prop)) {
      issues.push({
        code: "plan.unknown_preservation",
        message: `Unknown preservation property "${prop}"`,
        severity: "warning",
      });
    }
  }
  return issues;
}

/**
 * Validates an AI edit plan against the live scene *before* anything is applied.
 * This is the gate that keeps model output from corrupting a project.
 */
export function validateEditPlan(plan: EditPlan, scene: SceneDocument): PlanValidation {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const index = indexScene(scene);
  const affected = new Map<string, { object_id: string; name: string; type: ObjectType; changes: string[] }>();

  if (!Array.isArray(plan.operations) || plan.operations.length === 0) {
    errors.push({ code: "plan.empty", message: "Plan contains no operations", severity: "error" });
  }
  if (plan.operations.length > 200) {
    errors.push({ code: "plan.too_large", message: "Plan exceeds 200 operations; split it", severity: "error" });
  }

  warnings.push(...validatePreservation(plan.preserve));

  plan.operations.forEach((rawOp, i) => {
    const path = `operations.${i}`;
    const op = rawOp as EditOperation;
    if (!ALL_OPS.includes(op.op as (typeof ALL_OPS)[number])) {
      errors.push({ code: "plan.unknown_op", message: `Unknown operation "${op.op}"`, path, severity: "error" });
      return;
    }

    const allowed = OP_TARGET_TYPES[op.op];
    const isSceneLevel = Array.isArray(allowed) && allowed.length === 0;

    if (op.op === "add_object") {
      const spec = op.params?.object;
      if (!spec || !spec.name || !spec.type) {
        errors.push({ code: "plan.add_object_invalid", message: "add_object needs a name and type", path, severity: "error" });
        return;
      }
      if (!CREATABLE_TYPES.includes(spec.type)) {
        errors.push({
          code: "plan.add_object_type_blocked",
          message: `AI plans may not create "${spec.type}" objects; use the dedicated studio for those`,
          path,
          severity: "error",
        });
      }
      if (op.params.parent_id && !index.byId.has(op.params.parent_id)) {
        errors.push({ code: "plan.parent_missing", message: `add_object parent ${op.params.parent_id} does not exist`, path, severity: "error" });
      }
      affected.set(`new:${i}`, { object_id: `new:${i}`, name: spec.name, type: spec.type, changes: ["create"] });
    } else if (isSceneLevel) {
      if (op.target_id !== null) {
        errors.push({ code: "plan.target_not_allowed", message: `${op.op} is scene-level and takes target_id: null`, path, severity: "error" });
      }
    } else {
      const target = op.target_id ? index.byId.get(op.target_id) : undefined;
      if (!target) {
        errors.push({
          code: "plan.target_missing",
          message: `${op.op} targets object ${String(op.target_id)} which is not in the scene`,
          path,
          severity: "error",
        });
        return;
      }
      if (allowed && !allowed.includes(target.type)) {
        errors.push({
          code: "plan.target_type_mismatch",
          message: `${op.op} cannot target a ${target.type} (${target.name})`,
          path,
          severity: "error",
        });
      }
      if (target.locked) {
        errors.push({ code: "plan.target_locked", message: `"${target.name}" is locked; unlock it first`, path, severity: "error" });
      }
      if (target.protected) {
        warnings.push({
          code: "plan.target_protected",
          message: `"${target.name}" is protected and will require an explicit override`,
          path,
          severity: "warning",
        });
      }
      const entry = affected.get(target.id) ?? {
        object_id: target.id,
        name: target.name,
        type: target.type,
        changes: [],
      };
      entry.changes.push(describeOp(op, target.name));
      affected.set(target.id, entry);
    }

    // Preservation conflicts: the plan must not ask to change what it promised to keep.
    for (const prop of preservationConflicts(op, plan.preserve)) {
      errors.push({
        code: "plan.preservation_conflict",
        message: `${op.op} changes "${prop}" but the plan promises to preserve it`,
        path,
        severity: "error",
      });
    }

    if (op.op === "add_keyframe") {
      const frame = op.params?.frame;
      if (typeof frame !== "number" || frame < 0 || frame > scene.settings.duration_frames) {
        errors.push({
          code: "plan.keyframe_out_of_range",
          message: `Keyframe at frame ${String(frame)} is outside the scene duration`,
          path,
          severity: "error",
        });
      }
    }
    if (op.op === "add_animation") {
      const clip = op.params?.clip;
      if (!clip || clip.end_frame <= clip.start_frame) {
        errors.push({ code: "plan.clip_range_invalid", message: "Animation clip range is invalid", path, severity: "error" });
      } else if (clip.end_frame > scene.settings.duration_frames) {
        warnings.push({ code: "plan.clip_out_of_range", message: "Animation clip extends past the scene duration", path, severity: "warning" });
      }
    }
    if (op.op === "reparent") {
      const target = op.target_id ? index.byId.get(op.target_id) : undefined;
      const parentId = op.params?.parent_id ?? null;
      if (target && parentId) {
        let cursor: string | null = parentId;
        const seen = new Set<string>();
        while (cursor) {
          if (cursor === target.id) {
            errors.push({ code: "plan.reparent_cycle", message: `Reparenting "${target.name}" would create a cycle`, path, severity: "error" });
            break;
          }
          if (seen.has(cursor)) break;
          seen.add(cursor);
          cursor = index.byId.get(cursor)?.parent_id ?? null;
        }
      }
    }
  });

  const touchesIdentity = plan.operations.some((o) => o.op === "set_character");
  if (touchesIdentity && (plan.preserve?.properties ?? []).includes("identity")) {
    warnings.push({
      code: "plan.identity_review",
      message: "This edit changes character appearance; review the identity lock list before applying.",
      severity: "warning",
    });
  }

  if (plan.confidence < 0.5) {
    warnings.push({ code: "plan.low_confidence", message: "Planner confidence is low; confirm the targets manually.", severity: "warning" });
  }

  return { ok: errors.length === 0, errors, warnings, affected: [...affected.values()] };
}

export function describeOp(op: EditOperation, objectName: string): string {
  switch (op.op) {
    case "set_transform":
      return `move/rotate/scale ${objectName}`;
    case "set_material":
      return `change material of ${objectName}`;
    case "set_geometry_param":
      return `change ${op.params.param} of ${objectName}`;
    case "replace_geometry":
      return `replace geometry of ${objectName}`;
    case "set_visibility":
      return `${op.params.visible ? "show" : "hide"} ${objectName}`;
    case "set_locked":
      return `${op.params.locked ? "lock" : "unlock"} ${objectName}`;
    case "rename":
      return `rename ${objectName} to "${op.params.name}"`;
    case "reparent":
      return `re-parent ${objectName}`;
    case "add_object":
      return `create ${op.params.object.type} "${op.params.object.name}"`;
    case "remove_object":
      return `delete ${objectName}`;
    case "set_character":
      return `edit character ${objectName}`;
    case "set_camera":
      return `adjust camera ${objectName}`;
    case "set_light":
      return `adjust light ${objectName}`;
    case "set_environment":
      return "change the environment";
    case "set_global_style":
      return `set visual style to ${op.params.style}`;
    case "add_animation":
      return `add animation "${op.params.clip.name}" to ${objectName}`;
    case "add_keyframe":
      return `keyframe ${op.params.channel} at frame ${op.params.frame}`;
    case "set_shot":
      return `set shot "${op.params.shot.name}"`;
    default:
      return "unknown change";
  }
}

export function planSummary(plan: EditPlan, scene: SceneDocument): string {
  const validation = validateEditPlan(plan, scene);
  if (!validation.ok) {
    return `Plan rejected: ${validation.errors.map((e) => e.message).join("; ")}`;
  }
  const names = validation.affected.map((a) => a.name);
  return `${plan.summary} Affects: ${names.join(", ") || "nothing"}.`;
}
