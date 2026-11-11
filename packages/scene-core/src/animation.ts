import type { AnimationClip, Keyframe, SceneDocument, Vec3 } from "./types.js";

/**
 * Animation sampling.
 *
 * The viewport is a view of the document, so "playing" means: for the current
 * frame, compute each animated channel from the clips that target it. Nothing is
 * baked into the document by playback.
 */

export type SampledValue = number | Vec3 | string | boolean;

export interface SampledTransform {
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  visible?: boolean;
}

export interface SampleResult {
  /** object id -> transform overrides for this frame */
  transforms: Map<string, SampledTransform>;
  /** object id -> blend-shape weights from expression clips */
  expressions: Map<string, Record<string, number>>;
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerpNumber(a[0], b[0], t), lerpNumber(a[1], b[1], t), lerpNumber(a[2], b[2], t)];
}

/** Value of a track at a frame, honouring step / linear / bezier interpolation. */
export function sampleKeyframes(keyframes: Keyframe[], frame: number): SampledValue | null {
  if (keyframes.length === 0) return null;
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  if (frame <= first.frame) return first.value;
  if (frame >= last.frame) return last.value;

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (frame >= a.frame && frame <= b.frame) {
      const span = b.frame - a.frame;
      const raw = span === 0 ? 0 : (frame - a.frame) / span;
      if (a.interpolation === "step") return a.value;
      const t = a.interpolation === "bezier" ? smoothstep(raw) : raw;

      if (typeof a.value === "number" && typeof b.value === "number") {
        return lerpNumber(a.value, b.value, t);
      }
      if (Array.isArray(a.value) && Array.isArray(b.value)) {
        return lerpVec3(a.value as Vec3, b.value as Vec3, t);
      }
      // Strings/booleans (visibility, material ids) switch at the midpoint.
      return t < 0.5 ? a.value : b.value;
    }
  }
  return last.value;
}

function applyChannel(target: SampledTransform, channel: string, value: SampledValue): void {
  if (channel === "transform.position" && Array.isArray(value)) target.position = value as Vec3;
  else if (channel === "transform.rotation" && Array.isArray(value)) target.rotation = value as Vec3;
  else if (channel === "transform.scale" && Array.isArray(value)) target.scale = value as Vec3;
  else if (channel === "visible" && typeof value === "boolean") target.visible = value;
}

function clipActive(clip: AnimationClip, frame: number): boolean {
  if (clip.loop) return true;
  return frame >= clip.start_frame && frame <= clip.end_frame;
}

/**
 * Samples every clip at `frame`. Clips outside their range are ignored (unless
 * they loop), which is what makes a shot timeline read correctly.
 */
export function sampleScene(scene: SceneDocument, frame: number): SampleResult {
  const transforms = new Map<string, SampledTransform>();
  const expressions = new Map<string, Record<string, number>>();

  for (const clip of scene.animations) {
    if (!clipActive(clip, frame)) continue;

    const localFrame = clip.loop
      ? clip.start_frame + ((frame - clip.start_frame) % Math.max(1, clip.end_frame - clip.start_frame))
      : frame;

    for (const track of clip.tracks) {
      const value = sampleKeyframes(track.keyframes, localFrame);
      if (value === null) continue;

      if (track.channel.startsWith("expression.")) {
        const shape = track.channel.slice("expression.".length);
        const weights = expressions.get(clip.target_id) ?? {};
        if (typeof value === "number") weights[shape] = value;
        expressions.set(clip.target_id, weights);
        continue;
      }

      const target = transforms.get(clip.target_id) ?? {};
      applyChannel(target, track.channel, value);
      transforms.set(clip.target_id, target);
    }
  }

  return { transforms, expressions };
}

/** Total frames covered by clips, useful when a scene has no explicit duration. */
export function animationExtent(scene: SceneDocument): number {
  return scene.animations.reduce((max, clip) => Math.max(max, clip.end_frame), 0);
}
