import type { SceneDocument } from "./types.js";
import { MIN_SUPPORTED_SCHEMA_VERSION, SCENE_SCHEMA_VERSION } from "./types.js";
import { defaultEnvironment, defaultSettings } from "./defaults.js";

/**
 * Versioned scene migrations.
 *
 * Every migration is a pure function: (document at version N) -> (document at
 * version N+1). They run in order, are idempotent where possible and never
 * touch object ids, so old projects keep working when the model evolves.
 */

export interface Migration {
  from: string;
  to: string;
  description: string;
  migrate: (doc: Record<string, unknown>) => Record<string, unknown>;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export const migrations: Migration[] = [
  {
    from: "1.0",
    to: "1.1",
    description: "Add protected objects, shot list, material library and per-object version counters.",
    migrate: (doc) => {
      const next = { ...doc };
      const objects = Array.isArray(next.objects) ? (next.objects as Record<string, unknown>[]) : [];
      next.objects = objects.map((obj) => ({
        ...obj,
        protected: typeof obj.protected === "boolean" ? obj.protected : false,
        version: typeof obj.version === "number" ? obj.version : 1,
        tags: Array.isArray(obj.tags) ? obj.tags : [],
        texture_refs: Array.isArray(obj.texture_refs) ? obj.texture_refs : [],
        animation_refs: Array.isArray(obj.animation_refs) ? obj.animation_refs : [],
      }));
      if (!Array.isArray(next.materials)) next.materials = [];
      if (!Array.isArray(next.animations)) next.animations = [];
      if (!Array.isArray(next.shots)) next.shots = [];
      if (typeof next.active_camera_id === "undefined") next.active_camera_id = null;
      if (!next.settings) next.settings = defaultSettings();
      if (!next.environment) next.environment = defaultEnvironment();
      next.schema_version = "1.1";
      return next;
    },
  },
];

export interface MigrationResult {
  document: SceneDocument;
  applied: string[];
  from: string;
  to: string;
}

export function migrateScene(input: unknown): MigrationResult {
  if (typeof input !== "object" || input === null) throw new Error("migrateScene: document must be an object");
  let doc = { ...(input as Record<string, unknown>) };
  let version = typeof doc.schema_version === "string" ? doc.schema_version : "1.0";

  if (compareVersions(version, MIN_SUPPORTED_SCHEMA_VERSION) < 0) {
    throw new Error(`Scene schema ${version} is older than the supported minimum ${MIN_SUPPORTED_SCHEMA_VERSION}`);
  }
  if (compareVersions(version, SCENE_SCHEMA_VERSION) > 0) {
    throw new Error(`Scene schema ${version} is newer than this build (${SCENE_SCHEMA_VERSION}); upgrade the app`);
  }

  const applied: string[] = [];
  let guard = 0;
  while (compareVersions(version, SCENE_SCHEMA_VERSION) < 0) {
    const step = migrations.find((m) => m.from === version);
    if (!step) throw new Error(`No migration path from schema ${version}`);
    doc = step.migrate(doc);
    applied.push(`${step.from}->${step.to}`);
    version = step.to;
    guard += 1;
    if (guard > 32) throw new Error("Migration loop detected");
  }

  return {
    document: doc as unknown as SceneDocument,
    applied,
    from: typeof input === "object" && input !== null ? String((input as Record<string, unknown>).schema_version ?? "1.0") : "1.0",
    to: version,
  };
}
