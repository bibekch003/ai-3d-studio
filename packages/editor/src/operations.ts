import {
  newId,
  type EditOperation,
  type SceneDocument,
  type SceneObject,
  type Shot,
  type AnimationClip,
} from "@ai3d/scene-core";

export interface ApplyResult {
  scene: SceneDocument;
  /** Objects whose content changed, used for dirty-marking and history diffs. */
  touched: string[];
  note: string;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function bump(obj: SceneObject): SceneObject {
  return { ...obj, version: obj.version + 1 };
}

/**
 * Applies a single validated operation to a copy of the scene.
 * Callers must run validateEditPlan first; this function assumes targets exist.
 */
export function applyEditOperation(scene: SceneDocument, op: EditOperation): ApplyResult {
  const next = clone(scene);
  const touched: string[] = [];
  const update = (id: string, patch: (o: SceneObject) => SceneObject) => {
    const i = next.objects.findIndex((o) => o.id === id);
    if (i === -1) throw new Error(`applyEditOperation: object ${id} not found`);
    const updated = patch(next.objects[i] as SceneObject);
    next.objects[i] = bump(updated);
    touched.push(id);
  };

  switch (op.op) {
    case "set_transform":
      update(op.target_id, (o) => ({
        ...o,
        transform: {
          position: op.params.position ?? o.transform.position,
          rotation: op.params.rotation ?? o.transform.rotation,
          scale: op.params.scale ?? o.transform.scale,
        },
      }));
      break;
    case "set_material":
      update(op.target_id, (o) => ({
        ...o,
        material_overrides: { ...(o.material_overrides ?? {}), ...op.params.patch },
      }));
      break;
    case "set_geometry_param":
      update(op.target_id, (o) => {
        if (o.geometry.kind !== "primitive") return o;
        return { ...o, geometry: { ...o.geometry, params: { ...o.geometry.params, [op.params.param]: op.params.value } } };
      });
      break;
    case "replace_geometry":
      update(op.target_id, (o) => ({ ...o, geometry: op.params.geometry }));
      break;
    case "set_visibility":
      update(op.target_id, (o) => ({ ...o, visible: op.params.visible }));
      break;
    case "set_locked":
      update(op.target_id, (o) => ({ ...o, locked: op.params.locked }));
      break;
    case "rename":
      update(op.target_id, (o) => ({ ...o, name: op.params.name }));
      break;
    case "reparent":
      update(op.target_id, (o) => ({ ...o, parent_id: op.params.parent_id }));
      break;
    case "add_object": {
      const spec = op.params.object;
      const id = newId("obj");
      const obj: SceneObject = {
        id,
        name: spec.name,
        type: spec.type,
        parent_id: op.params.parent_id,
        transform: {
          position: spec.transform?.position ?? [0, 0, 0],
          rotation: spec.transform?.rotation ?? [0, 0, 0],
          scale: spec.transform?.scale ?? [1, 1, 1],
        },
        geometry: spec.geometry ?? { kind: "none" },
        material_id: spec.material_id ?? null,
        material_overrides: null,
        texture_refs: [],
        animation_refs: [],
        visible: true,
        locked: false,
        protected: false,
        tags: spec.tags ?? [],
        version: 1,
        metadata: { created_by: "ai_plan" },
      };
      next.objects.push(obj);
      touched.push(id);
      break;
    }
    case "remove_object": {
      const ids = new Set<string>([op.target_id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const o of next.objects) {
          if (o.parent_id && ids.has(o.parent_id) && !ids.has(o.id)) {
            ids.add(o.id);
            grew = true;
          }
        }
      }
      next.objects = next.objects.filter((o) => !ids.has(o.id));
      next.animations = next.animations.filter((a) => !ids.has(a.target_id));
      next.shots = next.shots.map((s) => ({ ...s, subjects: s.subjects.filter((x) => !ids.has(x)) }));
      if (next.active_camera_id && ids.has(next.active_camera_id)) next.active_camera_id = null;
      touched.push(...ids);
      break;
    }
    case "set_character":
      update(op.target_id, (o) => {
        if (!o.character) throw new Error(`set_character: ${o.name} is not a character`);
        const p = op.params.patch;
        return {
          ...o,
          character: {
            ...o.character,
            hair: p.hair ? { ...o.character.hair, ...p.hair } : o.character.hair,
            wardrobe: p.wardrobe ?? o.character.wardrobe,
            expression: p.expression ? { ...o.character.expression, ...p.expression } : o.character.expression,
            pose: p.pose ? { ...o.character.pose, ...p.pose } : o.character.pose,
            proportions: p.proportions ? { ...o.character.proportions, ...p.proportions } : o.character.proportions,
            age_band: p.age_band ?? o.character.age_band,
          },
        };
      });
      break;
    case "set_camera":
      update(op.target_id, (o) => {
        if (!o.camera) throw new Error(`set_camera: ${o.name} is not a camera`);
        return { ...o, camera: { ...o.camera, ...op.params.patch } };
      });
      break;
    case "set_light":
      update(op.target_id, (o) => {
        if (!o.light) throw new Error(`set_light: ${o.name} is not a light`);
        return { ...o, light: { ...o.light, ...op.params.patch } };
      });
      break;
    case "set_environment":
      next.environment = { ...next.environment, ...op.params.patch };
      break;
    case "set_global_style":
      next.environment = { ...next.environment, global_style: op.params.style };
      if (op.params.color_management) {
        next.settings = {
          ...next.settings,
          color_management: { ...next.settings.color_management, ...op.params.color_management },
        };
      }
      break;
    case "add_animation": {
      const spec = op.params.clip;
      const clip: AnimationClip = {
        id: newId("anim"),
        name: spec.name,
        target_id: op.target_id,
        kind: spec.kind,
        start_frame: spec.start_frame,
        end_frame: spec.end_frame,
        loop: spec.loop ?? false,
        source: spec.source ?? { kind: "manual", model_id: null },
        tracks: (spec.tracks ?? []).map((t) => ({
          id: newId("trk"),
          channel: t.channel,
          keyframes: t.keyframes.map((k) => ({ ...k, id: newId("kf") })),
        })),
      };
      next.animations.push(clip);
      update(op.target_id, (o) => ({ ...o, animation_refs: [...new Set([...o.animation_refs, clip.id])] }));
      break;
    }
    case "add_keyframe": {
      const clip = next.animations.find((a) => a.id === op.params.clip_id);
      if (!clip) throw new Error(`add_keyframe: clip ${op.params.clip_id} not found`);
      let track = clip.tracks.find((t) => t.channel === op.params.channel);
      if (!track) {
        track = { id: newId("trk"), channel: op.params.channel, keyframes: [] };
        clip.tracks.push(track);
      }
      track.keyframes = track.keyframes
        .filter((k) => k.frame !== op.params.frame)
        .concat({
          id: newId("kf"),
          frame: op.params.frame,
          value: op.params.value,
          interpolation: op.params.interpolation ?? "bezier",
        })
        .sort((a, b) => a.frame - b.frame);
      touched.push(op.target_id);
      break;
    }
    case "set_shot": {
      const shot: Shot = op.params.shot;
      const i = next.shots.findIndex((s) => s.id === shot.id);
      if (i === -1) next.shots.push(shot);
      else next.shots[i] = shot;
      next.shots.sort((a, b) => a.start_frame - b.start_frame).forEach((s, idx) => (s.index = idx));
      break;
    }
    default: {
      const exhaustive: never = op;
      throw new Error(`Unhandled operation ${JSON.stringify(exhaustive)}`);
    }
  }

  next.revision = scene.revision + 1;
  next.updated_at = new Date().toISOString();
  return { scene: next, touched, note: op.op };
}
