import { newId } from "./ids.js";
import type { EditOperation, Shot, VisualStyle } from "./types.js";

/**
 * AI Scene Director (deterministic implementation).
 *
 * Turns a written description into a structured, editable scene plan: cast,
 * props, environment, beat list, shot list and the operations needed to build
 * the set. It never emits executable code - only validated scene operations.
 */

export interface PlanCharacter {
  name: string;
  description: string;
  role: string;
  age_band: "child" | "teen" | "adult" | "senior" | "unspecified";
}

export interface PlanProp {
  name: string;
  description: string;
  interaction: string;
}

export interface PlanShot {
  index: number;
  name: string;
  description: string;
  camera_shot_type: string;
  camera_movement: string;
  start_frame: number;
  end_frame: number;
  subjects: string[];
  lighting_note: string;
  audio_note: string;
  transition_in: "cut" | "fade" | "dissolve" | "wipe";
}

export interface ScenePlan {
  id: string;
  prompt: string;
  logline: string;
  characters: PlanCharacter[];
  props: PlanProp[];
  environment: { preset_id: string; kind: "interior" | "exterior" | "studio"; time_of_day: string; description: string };
  beats: string[];
  shots: PlanShot[];
  total_frames: number;
  fps: number;
  style: VisualStyle;
  warnings: string[];
  producer: { kind: "deterministic" | "llm"; model_id: string | null };
  operations: EditOperation[];
  created_at: string;
}

const CHARACTER_WORDS: { word: string; label: string; age: PlanCharacter["age_band"] }[] = [
  { word: "boy", label: "Boy", age: "teen" },
  { word: "girl", label: "Girl", age: "teen" },
  { word: "man", label: "Man", age: "adult" },
  { word: "woman", label: "Woman", age: "adult" },
  { word: "young man", label: "Young man", age: "adult" },
  { word: "young woman", label: "Young woman", age: "adult" },
  { word: "child", label: "Child", age: "child" },
  { word: "old man", label: "Elderly man", age: "senior" },
  { word: "robot", label: "Robot", age: "unspecified" },
  { word: "detective", label: "Detective", age: "adult" },
];

const PROP_WORDS: { word: string; label: string; interaction: string }[] = [
  { word: "apple", label: "Apple", interaction: "picked up and bitten" },
  { word: "cup", label: "Cup", interaction: "picked up" },
  { word: "mug", label: "Mug", interaction: "picked up" },
  { word: "book", label: "Book", interaction: "opened" },
  { word: "door", label: "Door", interaction: "opened" },
  { word: "phone", label: "Phone", interaction: "picked up" },
  { word: "knife", label: "Knife", interaction: "picked up" },
  { word: "bottle", label: "Bottle", interaction: "poured" },
  { word: "key", label: "Key", interaction: "picked up" },
  { word: "letter", label: "Letter", interaction: "read" },
];

const ENV_WORDS: { word: string; preset: string; kind: ScenePlan["environment"]["kind"]; label: string }[] = [
  { word: "room", preset: "room.domestic.small", kind: "interior", label: "A small domestic room" },
  { word: "kitchen", preset: "room.kitchen.modern", kind: "interior", label: "A modern kitchen" },
  { word: "office", preset: "room.office.open", kind: "interior", label: "An open-plan office" },
  { word: "laboratory", preset: "room.lab.futuristic", kind: "interior", label: "A futuristic laboratory" },
  { word: "lab", preset: "room.lab.futuristic", kind: "interior", label: "A futuristic laboratory" },
  { word: "street", preset: "urban.street.narrow", kind: "exterior", label: "A narrow street" },
  { word: "city", preset: "urban.city.downtown", kind: "exterior", label: "A city centre" },
  { word: "forest", preset: "landscape.forest.temperate", kind: "exterior", label: "A temperate forest" },
  { word: "beach", preset: "landscape.beach.tropical", kind: "exterior", label: "A tropical beach" },
  { word: "desert", preset: "landscape.desert.dunes", kind: "exterior", label: "Desert dunes" },
];

const ACTION_VERBS: { word: string; beat: string }[] = [
  { word: "enters", beat: "enters" },
  { word: "enter", beat: "enters" },
  { word: "walks", beat: "walks towards" },
  { word: "runs", beat: "runs towards" },
  { word: "picks up", beat: "picks up" },
  { word: "takes a bite", beat: "bites into" },
  { word: "sits", beat: "sits on" },
  { word: "opens", beat: "opens" },
  { word: "closes", beat: "closes" },
  { word: "looks at", beat: "looks at" },
  { word: "turns", beat: "turns towards" },
  { word: "puts down", beat: "puts down" },
  { word: "throws", beat: "throws" },
  { word: "reads", beat: "reads" },
];

const STYLE_WORDS: { word: string; style: VisualStyle }[] = [
  { word: "cinematic", style: "cinematic" },
  { word: "photoreal", style: "photoreal" },
  { word: "anime", style: "anime" },
  { word: "noir", style: "noir" },
  { word: "clay", style: "clay_render" },
  { word: "low poly", style: "low_poly" },
  { word: "stylised", style: "stylised" },
];

const TIME_WORDS = ["dawn", "morning", "noon", "afternoon", "sunset", "dusk", "night"];

export function planScene(prompt: string, opts: { fps?: number; seconds?: number; now?: string } = {}): ScenePlan {
  const lower = prompt.toLowerCase();
  const fps = opts.fps ?? 24;
  const warnings: string[] = [];

  const characters: PlanCharacter[] = [];
  const matchedWords: string[] = [];
  // Longest phrase first so "young man" wins over "man".
  for (const c of [...CHARACTER_WORDS].sort((a, b) => b.word.length - a.word.length)) {
    if (matchedWords.some((w) => w.includes(c.word))) continue;
    if (new RegExp(`\\b${c.word}\\b`).test(lower) && !characters.some((x) => x.name === c.label.replace(/\s+/g, "_"))) {
      matchedWords.push(c.word);
      characters.push({
        name: c.label.replace(/\s+/g, "_"),
        description: `${c.label} matching the prompt: "${prompt.slice(0, 120)}"`,
        role: characters.length === 0 ? "lead" : "support",
        age_band: c.age,
      });
    }
  }
  if (!characters.length) {
    characters.push({ name: "Character_Lead", description: "Unspecified lead character", role: "lead", age_band: "unspecified" });
    warnings.push("No character was named in the prompt; a generic lead was cast. Assign a character profile in the Character Studio.");
  }

  const props: PlanProp[] = [];
  for (const p of PROP_WORDS) {
    if (new RegExp(`\\b${p.word}\\b`).test(lower)) {
      props.push({ name: p.label, description: `A ${p.word} named in the prompt`, interaction: p.interaction });
    }
  }
  if (!props.length) warnings.push("No interactable prop was named; the plan contains performance-only beats.");

  const env = ENV_WORDS.find((e) => new RegExp(`\\b${e.word}\\b`).test(lower)) ?? {
    word: "room",
    preset: "room.domestic.small",
    kind: "interior" as const,
    label: "An unspecified interior",
  };
  if (env.word === "room" && !/\broom\b/.test(lower)) warnings.push("Environment was not specified; defaulted to a neutral interior set.");

  const timeOfDay = TIME_WORDS.find((t) => lower.includes(t)) ?? "afternoon";
  const style = STYLE_WORDS.find((s) => lower.includes(s.word))?.style ?? "cinematic";

  const beats: string[] = [];
  for (const a of ACTION_VERBS) {
    if (lower.includes(a.word)) {
      const target = props[0]?.name.toLowerCase();
      beats.push(a.beat === "picks up" || a.beat === "bites into" || a.beat === "opens" || a.beat === "puts down" ? `${a.beat} the ${target ?? "object"}` : a.beat);
    }
  }
  const uniqueBeats = [...new Set(beats)];
  if (!uniqueBeats.length) {
    uniqueBeats.push("holds the pose", "reacts", "exits frame");
    warnings.push("No action verb was recognised; the beat sheet uses generic performance beats.");
  }

  // Beat -> shot list. One shot per beat, plus an establishing shot.
  const secondsPerShot = Math.max(2, Math.round((opts.seconds ?? 10) / (uniqueBeats.length + 1)));
  const framesPerShot = secondsPerShot * fps;
  const shotNames = ["Establishing", ...uniqueBeats.map((b) => titleCase(b))];
  const movements = ["dolly", "truck", "static", "dolly", "static", "orbit", "static"];
  const shotTypes = ["wide", "medium", "medium", "close_up", "close_up", "over_the_shoulder", "medium"];

  const shots: PlanShot[] = shotNames.map((name, i) => ({
    index: i,
    name,
    description:
      i === 0
        ? `Establishing shot of ${env.label.toLowerCase()}, ${timeOfDay} light.`
        : `${titleCase(uniqueBeats[i - 1] ?? "beat")} - framed as a ${shotTypes[i % shotTypes.length]!.replace("_", " ")}.`,
    camera_shot_type: shotTypes[i % shotTypes.length]!,
    camera_movement: movements[i % movements.length]!,
    start_frame: i * framesPerShot,
    end_frame: (i + 1) * framesPerShot,
    subjects: [characters[0]!.name, ...(props[0] ? [props[0].name] : [])],
    lighting_note: `${timeOfDay} key light, warm practical fill`,
    audio_note: i === 0 ? "room tone, low score in" : "dialogue-free action, score continues",
    transition_in: i === 0 ? "fade" : "cut",
  }));

  const totalFrames = shots.length * framesPerShot;

  const operations: EditOperation[] = [
    {
      op: "set_environment",
      target_id: null,
      params: {
        patch: {
          preset_id: env.preset,
          kind: env.kind,
          time_of_day: timeOfDay as never,
          global_style: style,
        },
      },
    },
    ...props.map<EditOperation>((p, i) => ({
      op: "add_object",
      target_id: null,
      params: {
        object: {
          name: p.name,
          type: "prop",
          tags: ["plan", "prop", p.name.toLowerCase()],
          transform: { position: [1.0 - i * 0.4, 0.8, -1.2] },
        },
        parent_id: null,
      },
    })),
    ...shots.map<EditOperation>((s) => ({
      op: "set_shot",
      target_id: null,
      params: {
        shot: {
          id: newId("shot"),
          index: s.index,
          name: s.name,
          camera_id: null,
          start_frame: s.start_frame,
          end_frame: s.end_frame,
          description: s.description,
          subjects: [],
          transition_in: s.transition_in,
        } satisfies Shot,
      },
    })),
  ];

  return {
    id: newId("dirplan"),
    prompt,
    logline: `${characters[0]!.name.replace(/_/g, " ")} ${uniqueBeats.join(", then ")} in ${env.label.toLowerCase()}.`,
    characters,
    props,
    environment: { preset_id: env.preset, kind: env.kind, time_of_day: timeOfDay, description: env.label },
    beats: uniqueBeats,
    shots,
    total_frames: totalFrames,
    fps,
    style,
    warnings,
    producer: { kind: "deterministic", model_id: null },
    operations,
    created_at: opts.now ?? new Date().toISOString(),
  };
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
