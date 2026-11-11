import { newId } from "./ids.js";
import { ancestors, indexScene, searchObjects } from "./scene.js";
import type {
  EditOperation,
  EditPlan,
  ObjectType,
  PbrMaterial,
  PlanTarget,
  PreservationPolicy,
  SceneDocument,
  SceneObject,
  VisualStyle,
} from "./types.js";

/**
 * Deterministic natural-language edit planner.
 *
 * This is the *local* planner: a rule engine over the scene graph with no
 * network calls and no model weights. It is deliberately labelled as such
 * (producer.kind = "deterministic") and it never claims to be an LLM. The
 * server-side AI orchestrator exposes the same contract and may delegate to a
 * hosted model; both produce a structured EditPlan that is validated before it
 * can touch a scene.
 */

export interface PlannerOptions {
  now?: string;
  /** Restrict planning to these object ids (e.g. the current selection). */
  scope?: string[];
}

export const MATERIAL_PRESETS: Record<string, Partial<PbrMaterial>> = {
  oak: { name: "Old oak", base_color: "#7a5230", roughness: 0.72, metallic: 0, procedural: { id: "wood.oak", params: { grain: 0.55 } } },
  walnut: { name: "Walnut", base_color: "#4b2f1c", roughness: 0.55, metallic: 0, procedural: { id: "wood.walnut", params: { grain: 0.7 } } },
  pine: { name: "Pine", base_color: "#c39a6b", roughness: 0.8, metallic: 0, procedural: { id: "wood.pine", params: { grain: 0.4 } } },
  marble: { name: "Carrara marble", base_color: "#e8e6e1", roughness: 0.18, metallic: 0, procedural: { id: "stone.marble", params: { veins: 0.6 } } },
  concrete: { name: "Concrete", base_color: "#9a9a96", roughness: 0.92, metallic: 0, procedural: { id: "stone.concrete", params: { pores: 0.3 } } },
  metal: { name: "Brushed metal", base_color: "#b8bcc0", roughness: 0.28, metallic: 1 },
  brass: { name: "Aged brass", base_color: "#b08d57", roughness: 0.35, metallic: 1 },
  glass: { name: "Clear glass", base_color: "#dfe9ee", roughness: 0.05, metallic: 0, opacity: 0.25, ior: 1.52 },
  linen: { name: "Linen", base_color: "#d8cfc0", roughness: 0.95, metallic: 0, procedural: { id: "fabric.linen", params: { weave: 0.5 } } },
  leather: { name: "Worn leather", base_color: "#5b3a2a", roughness: 0.6, metallic: 0, procedural: { id: "fabric.leather", params: { creases: 0.6 } } },
  ceramic: { name: "Glazed ceramic", base_color: "#e4e0d6", roughness: 0.12, metallic: 0 },
  neon: { name: "Neon", base_color: "#22d3ee", roughness: 0.4, metallic: 0, emissive: "#22d3ee", emissive_strength: 6 },
};

export const NAMED_COLORS: Record<string, string> = {
  red: "#a41f1f",
  crimson: "#8c1c2b",
  orange: "#d97a2b",
  yellow: "#e3c33c",
  green: "#2f6b3a",
  teal: "#2b7a78",
  blue: "#2f4a72",
  navy: "#1d2b45",
  purple: "#5b3f8c",
  pink: "#c46a8a",
  brown: "#6b4a2f",
  black: "#141414",
  white: "#f2f0ec",
  grey: "#8a8a8a",
  gray: "#8a8a8a",
  gold: "#b08d57",
  silver: "#c0c4c8",
};

const HAIR_PRESETS: Record<string, string> = {
  short: "hair.short_crop",
  buzz: "hair.buzz",
  long: "hair.long_wave",
  curly: "hair.curly_medium",
  bald: "hair.none",
  bun: "hair.bun",
  ponytail: "hair.ponytail",
  tousled: "hair.short_tousled",
};

const ENVIRONMENT_PRESETS: Record<string, { preset_id: string; kind: "interior" | "exterior" | "studio" | "abstract" }> = {
  laboratory: { preset_id: "room.lab.futuristic", kind: "interior" },
  lab: { preset_id: "room.lab.futuristic", kind: "interior" },
  forest: { preset_id: "landscape.forest.temperate", kind: "exterior" },
  street: { preset_id: "urban.street.narrow", kind: "exterior" },
  city: { preset_id: "urban.city.downtown", kind: "exterior" },
  beach: { preset_id: "landscape.beach.tropical", kind: "exterior" },
  desert: { preset_id: "landscape.desert.dunes", kind: "exterior" },
  room: { preset_id: "room.domestic.small", kind: "interior" },
  kitchen: { preset_id: "room.kitchen.modern", kind: "interior" },
  office: { preset_id: "room.office.open", kind: "interior" },
  studio: { preset_id: "studio.cyc.infinity", kind: "studio" },
};

const STYLE_PRESETS: { style: VisualStyle; words: string[] }[] = [
  { style: "cinematic", words: ["cinematic", "film look", "anamorphic"] },
  { style: "photoreal", words: ["photoreal", "photorealistic", "realistic"] },
  { style: "anime", words: ["anime", "manga", "cel shaded"] },
  { style: "noir", words: ["noir", "black and white", "monochrome"] },
  { style: "clay_render", words: ["clay", "claymation"] },
  { style: "low_poly", words: ["low poly", "lowpoly"] },
  { style: "stylised", words: ["stylised", "stylized", "cartoon"] },
];

const ACTION_CLIPS: { id: string; words: string[]; frames: number; kind: "pose" | "transform" }[] = [
  { id: "walk", words: ["walk", "walks", "walking"], frames: 48, kind: "transform" },
  { id: "run", words: ["run", "runs", "running"], frames: 36, kind: "transform" },
  { id: "pickup", words: ["pick up", "picks up", "picking up", "picking", "grab", "grabs", "grabbing"], frames: 36, kind: "pose" },
  { id: "putdown", words: ["put down", "puts down", "putting down", "place", "placing"], frames: 36, kind: "pose" },
  { id: "open", words: ["open", "opens", "opening"], frames: 30, kind: "pose" },
  { id: "close", words: ["close", "closes", "closing"], frames: 30, kind: "pose" },
  { id: "sit", words: ["sit", "sits", "sitting"], frames: 42, kind: "pose" },
  { id: "turn", words: ["turn", "turns", "turning", "look at", "looking at"], frames: 24, kind: "pose" },
  { id: "wave", words: ["wave", "waves", "waving", "gesture", "gesturing"], frames: 36, kind: "pose" },
];

const EXPRESSIONS: { name: string; words: string[]; weights: Record<string, number> }[] = [
  { name: "smile", words: ["smile", "smiling", "happy", "grin"], weights: { mouth_smile: 1, cheek_raise: 0.4 } },
  { name: "frown", words: ["frown", "sad", "unhappy"], weights: { mouth_smile: 0, mouth_frown: 0.8 } },
  { name: "angry", words: ["angry", "furious", "mad"], weights: { brow_down: 0.9, mouth_press: 0.6 } },
  { name: "surprised", words: ["surprised", "shocked", "amazed"], weights: { brow_up: 0.9, jaw_open: 0.5 } },
  { name: "neutral", words: ["neutral", "expressionless"], weights: { mouth_smile: 0.1, brow_neutral: 1 } },
];

function parsePreservation(lower: string): PreservationPolicy {
  const properties = new Set<string>();
  const patterns: [RegExp, string][] = [
    [/\b(preserve|keep|maintain|without changing|don't change|do not change)\b[^.]*\bface\b/, "face"],
    [/\b(preserve|keep|maintain)\b[^.]*\b(hair|hairstyle)\b/, "hair"],
    [/\b(preserve|keep|maintain)\b[^.]*\b(identity|same person|recognisable|recognizable)\b/, "identity"],
    [/\b(preserve|keep|maintain)\b[^.]*\bmaterial/, "materials"],
    [/\b(preserve|keep|maintain)\b[^.]*\b(position|placement|where)\b/, "transform"],
    [/\b(preserve|keep|maintain)\b[^.]*\b(animation|motion)\b/, "animation"],
    [/\b(preserve|keep|maintain)\b[^.]*\bcamera\b/, "camera"],
    [/\b(preserve|keep|maintain)\b[^.]*\blight/, "lighting"],
    [/\b(preserve|keep|maintain)\b[^.]*\b(other|everything else|rest of)\b/, "identity"],
  ];
  for (const [re, prop] of patterns) if (re.test(lower)) properties.add(prop);
  if (/\bpreserve his face\b/.test(lower)) properties.add("face");
  return { properties: [...properties], object_ids: [] };
}

function resolve(scene: SceneDocument, query: string, scope?: string[]): { object: SceneObject | null; score: number; candidates: SceneObject[] } {
  const pool = scope && scope.length ? scene.objects.filter((o) => scope.includes(o.id)) : scene.objects;
  const matches = searchObjects({ ...scene, objects: pool }, query, 6);
  if (!matches.length) return { object: null, score: 0, candidates: [] };
  return {
    object: matches[0]!.object,
    score: matches[0]!.score,
    candidates: matches.slice(0, 4).map((m) => m.object),
  };
}

function firstOfType(scene: SceneDocument, type: ObjectType): SceneObject | null {
  return scene.objects.find((o) => o.type === type) ?? null;
}

/** Extracts the noun phrase after a verb like "the table" / "his hair". */
function nounAfter(lower: string, verbs: string[]): string | null {
  for (const verb of verbs) {
    const re = new RegExp(`${verb}\\s+(?:the\\s+|a\\s+|an\\s+|his\\s+|her\\s+|their\\s+|my\\s+)?([a-z0-9 _-]{2,40})`);
    const m = lower.match(re);
    if (m?.[1]) return m[1].trim().split(/\s+(?:to|so|and|with|but|look|into)\b/)[0]!.trim();
  }
  return null;
}

export function planEdit(prompt: string, scene: SceneDocument, opts: PlannerOptions = {}): EditPlan {
  const lower = prompt.toLowerCase().trim();
  const operations: EditOperation[] = [];
  const targets = new Map<string, PlanTarget>();
  const warnings: string[] = [];
  const preserve = parsePreservation(lower);
  let scoreSum = 0;
  let scoreCount = 0;

  const addTarget = (obj: SceneObject, reason: string, confidence: number) => {
    if (!targets.has(obj.id)) {
      targets.set(obj.id, { object_id: obj.id, name: obj.name, type: obj.type, reason, confidence });
    }
    scoreSum += confidence;
    scoreCount += 1;
  };

  /* ------------------------------ hairstyle ------------------------------ */
  if (/\b(hair|hairstyle|haircut|buzz cut|trim)\b/.test(lower)) {
    const explicit = Object.keys(HAIR_PRESETS).find((k) => lower.includes(k));
    const subject = resolve(scene, "hair", opts.scope).object
      ? resolve(scene, "hair", opts.scope)
      : { object: firstOfType(scene, "character"), score: 0.6, candidates: [] };
    if (subject.object) {
      const idx = indexScene(scene);
      const character =
        subject.object.type === "character"
          ? subject.object
          : [...ancestors(idx, subject.object.id)].reverse().find((o) => o.type === "character") ??
            scene.objects.find((o) => o.type === "character");
      if (character?.character) {
        const style = explicit ? HAIR_PRESETS[explicit]! : "hair.short_tousled";
        operations.push({ op: "set_character", target_id: character.id, params: { patch: { hair: { style_id: style } } } });
        addTarget(character, "named in prompt (hair)", subject.score || 0.6);
        if (/\bcolou?r\b/.test(lower)) {
          const colour = lower.match(/#[0-9a-f]{6}/)?.[0];
          if (colour) {
            operations.push({ op: "set_character", target_id: character.id, params: { patch: { hair: { color: colour } } } });
          }
        }
      }
    }
  }

  /* ------------------------------ expression ----------------------------- */
  for (const expr of EXPRESSIONS) {
    if (expr.words.some((w) => lower.includes(w)) && /\b(face|expression|smile|frown|angry|surprised|look)\b/.test(lower)) {
      const character = firstOfType(scene, "character");
      if (character?.character) {
        operations.push({ op: "set_character", target_id: character.id, params: { patch: { expression: expr.weights } } });
        addTarget(character, `expression "${expr.name}"`, 0.8);
      }
      break;
    }
  }

  /* ------------------------------ materials ------------------------------ */
  const materialKey = Object.keys(MATERIAL_PRESETS).find((k) => lower.includes(k));
  const surfaceWords = /\b(material|texture|surface|look like|glossy|shiny|matte|polished|rough|metallic|painted)\b/;
  const colourKey = Object.keys(NAMED_COLORS).find((c) => new RegExp(`\\b${c}\\b`).test(lower));
  if (materialKey || surfaceWords.test(lower) || colourKey) {
    const noun = nounAfter(lower, ["make", "change", "replace", "turn"]) ?? nounAfter(lower, ["material of"]);
    const target = noun ? resolve(scene, noun, opts.scope) : { object: null, score: 0, candidates: [] };
    const fallback = target.object ?? firstOfType(scene, "furniture") ?? firstOfType(scene, "prop");
    if (fallback) {
      const preset = materialKey ? MATERIAL_PRESETS[materialKey]! : null;
      operations.push({
        op: "set_material",
        target_id: fallback.id,
        params: {
          patch: preset ?? {
            name: "AI material",
            base_color:
              lower.match(/#[0-9a-f]{6}/)?.[0] ?? (colourKey ? NAMED_COLORS[colourKey]! : "#8a8a8a"),
            roughness: /shiny|glossy|polished/.test(lower) ? 0.15 : 0.7,
            metallic: /metal|steel|chrome|brass/.test(lower) ? 1 : 0,
          },
        },
      });
      addTarget(fallback, materialKey ? `material preset "${materialKey}"` : "material instruction", target.score || 0.55);
      if (!materialKey) warnings.push("No named material preset found; used a neutral PBR patch. Refine colour and roughness in the inspector.");
    } else {
      warnings.push("Could not find an object to re-material.");
    }
  }

  /* --------------------------- replace A with B -------------------------- */
  const replaceMatch = lower.match(/replace\s+(?:the\s+|his\s+|her\s+)?([a-z0-9 _-]{2,30})\s+with\s+(?:a\s+|an\s+|the\s+)?([a-z0-9 _-]{2,40})/);
  if (replaceMatch?.[1] && replaceMatch[2]) {
    const target = resolve(scene, replaceMatch[1], opts.scope);
    const replacement = replaceMatch[2].trim();
    if (target.object) {
      const generator = `prop.${replacement.replace(/[^a-z0-9]+/g, "_")}`;
      operations.push({
        op: "replace_geometry",
        target_id: target.object.id,
        params: { geometry: { kind: "procedural", generator, params: { variant: replacement } } },
      });
      operations.push({ op: "rename", target_id: target.object.id, params: { name: replacement.replace(/\b\w/g, (c) => c.toUpperCase()) } });
      addTarget(target.object, `replaced with "${replacement}"`, target.score);
      warnings.push(`Asset generator "${generator}" must exist in the asset library, otherwise the object keeps its silhouette until a real model is attached.`);
    } else {
      warnings.push(`Could not resolve "${replaceMatch[1]}" for replacement.`);
    }
  }

  /* ------------------------------ lighting ------------------------------- */
  if (/\b(light|lighting|lit|sunset|sunrise|golden hour|night|dusk|moody|dramatic)\b/.test(lower)) {
    const lights = scene.objects.filter((o) => o.type === "light");
    const sunset = /\b(sunset|golden hour|warm)\b/.test(lower);
    const night = /\bnight|moonlit\b/.test(lower);
    const dramatic = /\b(dramatic|moody|contrast|noir)\b/.test(lower);
    for (const light of lights) {
      const patch: Record<string, unknown> = {};
      if (light.light?.role === "key") {
        patch.color = night ? "#8fa8ff" : sunset ? "#ffb066" : "#ffe9c9";
        patch.intensity_watts = night ? 40 : sunset ? 180 : 220;
        if (dramatic) patch.softness = 0.15;
      }
      if (light.light?.role === "fill") {
        patch.intensity_watts = night ? 12 : 50;
        patch.color = night ? "#5f78ff" : "#cfe0ff";
      }
      if (light.light?.role === "practical") {
        patch.color = night ? "#4a6bff" : sunset ? "#ff9a4d" : "#fff3dd";
        patch.intensity_watts = night ? 1 : sunset ? 6 : 4;
      }
      if (Object.keys(patch).length) operations.push({ op: "set_light", target_id: light.id, params: { patch: patch as never } });
      addTarget(light, "lighting instruction", 0.75);
    }
    operations.push({
      op: "set_environment",
      target_id: null,
      params: {
        patch: {
          time_of_day: night ? "night" : sunset ? "sunset" : scene.environment.time_of_day,
          sky: { ...scene.environment.sky, color: night ? "#0b1224" : sunset ? "#f4a261" : scene.environment.sky.color },
        },
      },
    });
    if (!lights.length) warnings.push("Scene has no lights; only the environment was adjusted.");
  }

  /* ------------------------------ environment ---------------------------- */
  const envKey = Object.keys(ENVIRONMENT_PRESETS).find((k) => new RegExp(`\\b${k}\\b`).test(lower));
  if (envKey && /\b(room|look like|environment|set in|background|interior|exterior)\b/.test(lower)) {
    const preset = ENVIRONMENT_PRESETS[envKey]!;
    operations.push({
      op: "set_environment",
      target_id: null,
      params: { patch: { preset_id: preset.preset_id, kind: preset.kind } },
    });
    warnings.push(`Environment preset "${preset.preset_id}" is a set recipe; review the generated dressing before final render.`);
  }

  /* -------------------------------- style -------------------------------- */
  for (const style of STYLE_PRESETS) {
    if (style.words.some((w) => lower.includes(w))) {
      operations.push({ op: "set_global_style", target_id: null, params: { style: style.style } });
      break;
    }
  }

  /* ------------------------------ camera --------------------------------- */
  if (/\b(camera|close[- ]up|wide shot|framing|dolly|zoom|angle|shot)\b/.test(lower)) {
    const camera = firstOfType(scene, "camera");
    if (camera) {
      const patch: Record<string, unknown> = {};
      if (/close[- ]?up/.test(lower)) Object.assign(patch, { shot_type: "close_up", focal_length_mm: 85, fstop: 1.8, dof_enabled: true });
      if (/wide/.test(lower)) Object.assign(patch, { shot_type: "wide", focal_length_mm: 24, fstop: 5.6 });
      if (/dolly|push in/.test(lower)) patch.movement = "dolly";
      if (/handheld/.test(lower)) patch.movement = "handheld";
      if (/slow|shallow|bokeh/.test(lower)) patch.fstop = 1.4;
      if (Object.keys(patch).length) {
        operations.push({ op: "set_camera", target_id: camera.id, params: { patch: patch as never } });
        addTarget(camera, "camera instruction", 0.8);
      }
    }
  }

  /* ------------------------------ animation ------------------------------ */
  const action = ACTION_CLIPS.find((a) => a.words.some((w) => lower.includes(w)));
  if (action && /\b(animate|animation|make him|make her|make it|have him|have her)\b/.test(lower)) {
    const character = firstOfType(scene, "character");
    const target = character ?? firstOfType(scene, "prop");
    if (target) {
      const start = 0;
      operations.push({
        op: "add_animation",
        target_id: target.id,
        params: {
          clip: {
            name: `AI ${action.id}`,
            kind: action.kind,
            start_frame: start,
            end_frame: start + action.frames,
            loop: false,
            source: { kind: "ai", model_id: "local.rule-engine", prompt },
            tracks: [
              {
                channel: action.kind === "transform" ? "transform.position" : "pose.bone.upper_arm_r.rotation",
                keyframes: [
                  { id: "kf_a", frame: start, value: action.kind === "transform" ? target.transform.position : [0, 0, 0], interpolation: "bezier" },
                  { id: "kf_b", frame: start + action.frames, value: action.kind === "transform" ? target.transform.position : [-1.1, 0.1, 0.2], interpolation: "bezier" },
                ],
              },
            ],
          },
        },
      });
      addTarget(target, `action "${action.id}"`, 0.65);
      warnings.push(`"${action.id}" is a procedural placeholder clip. Attach a motion-model clip for production animation.`);
    }
  }

  /* ------------------------------- add prop ------------------------------ */
  // "put a vase on the table", "add a chair", "create a lamp near the door"
  const addMatch = lower.match(
    /\b(?:add|create|put|place|insert|spawn)\s+(?:a\s+|an\s+|the\s+)?([a-z0-9 _-]{3,30})/,
  );
  if (addMatch?.[1] && !replaceMatch) {
    const noun = addMatch[1].split(/\s+(?:on|in|at|near|next|beside|to)\b/)[0]!.trim();
    const existing = resolve(scene, noun, opts.scope).object;
    if (existing) {
      warnings.push(`"${noun}" already exists as "${existing.name}"; select it instead of adding a duplicate.`);
      addTarget(existing, "already in the scene", 0.7);
    } else {
      const label = noun.replace(/\b\w/g, (c) => c.toUpperCase());
      operations.push({
        op: "add_object",
        target_id: null,
        params: {
          object: {
            name: label,
            type: "prop",
            geometry: { kind: "primitive", primitive: "box", params: { width: 0.2, height: 0.2, depth: 0.2 } },
            tags: ["prop", "ai_added"],
            transform: { position: [0.4, 0.8, -0.6] },
          },
          parent_id: null,
        },
      });
      warnings.push(`"${label}" is a placeholder box; attach a real asset in Assets to refine it.`);
    }
  }

  /* --------------------------- visibility / misc ------------------------- */
  if (/\b(hide|show|unhide)\b/.test(lower)) {
    const noun = nounAfter(lower, ["hide", "show", "unhide"]);
    const target = noun ? resolve(scene, noun, opts.scope).object : null;
    if (target) {
      operations.push({ op: "set_visibility", target_id: target.id, params: { visible: !lower.includes("hide") } });
      addTarget(target, "visibility instruction", 0.8);
    }
  }
  if (/\b(delete|remove)\b/.test(lower) && !replaceMatch) {
    const noun = nounAfter(lower, ["delete", "remove"]);
    const target = noun ? resolve(scene, noun, opts.scope).object : null;
    if (target) {
      operations.push({ op: "remove_object", target_id: target.id, params: {} });
      addTarget(target, "deletion request", 0.7);
      warnings.push("Deletion removes the object and its children from this scene version; undo is available.");
    }
  }

  /* ---------------------------- identity guard --------------------------- */
  if (preserve.properties.includes("identity") && operations.some((o) => o.op === "set_character")) {
    const idx = operations.findIndex((o) => o.op === "set_character");
    if (idx >= 0) {
      operations.splice(idx, 1);
      warnings.push("Character appearance edit dropped because the prompt asked to preserve identity.");
    }
  }

  const confidence = operations.length === 0 ? 0.1 : Math.min(0.97, 0.45 + (scoreCount ? scoreSum / scoreCount : 0.3) * 0.5);
  if (operations.length === 0) {
    warnings.push(
      'No editable change could be derived from this instruction. Try naming an object ("the apple"), a property ("oak wood", "sunset lighting") and a verb ("make", "replace", "animate").',
    );
  }

  const affectedNames = [...targets.values()].map((t) => t.name);
  return {
    id: newId("plan"),
    prompt,
    summary:
      operations.length === 0
        ? "Nothing to change"
        : `${operations.length} change${operations.length === 1 ? "" : "s"} to ${affectedNames.length ? affectedNames.join(", ") : "the scene"}`,
    targets: [...targets.values()],
    operations,
    preserve,
    confidence: Number(confidence.toFixed(2)),
    warnings,
    requires_confirmation: confidence < 0.5 || warnings.some((w) => /placeholder|must exist|dropped/i.test(w)),
    producer: { kind: "deterministic", model_id: null },
    estimated_cost_usd: 0,
    created_at: opts.now ?? new Date().toISOString(),
  };
}
