import type { ObjectType, SceneDocument, SceneObject } from "./types.js";

export interface SceneIndex {
  byId: Map<string, SceneObject>;
  children: Map<string | null, SceneObject[]>;
  roots: SceneObject[];
}

/** Builds lookup structures once per scene revision. O(n). */
export function indexScene(scene: SceneDocument): SceneIndex {
  const byId = new Map<string, SceneObject>();
  const children = new Map<string | null, SceneObject[]>();
  for (const obj of scene.objects) byId.set(obj.id, obj);
  for (const obj of scene.objects) {
    const parent = obj.parent_id && byId.has(obj.parent_id) ? obj.parent_id : null;
    const list = children.get(parent) ?? [];
    list.push(obj);
    children.set(parent, list);
  }
  const roots = children.get(null) ?? [];
  return { byId, children, roots };
}

export function getObject(index: SceneIndex, id: string | null | undefined): SceneObject | null {
  if (!id) return null;
  return index.byId.get(id) ?? null;
}

export function childrenOf(index: SceneIndex, id: string | null): SceneObject[] {
  return index.children.get(id) ?? [];
}

/** Depth-first descendants, excluding the object itself. */
export function descendants(index: SceneIndex, id: string): SceneObject[] {
  const out: SceneObject[] = [];
  const stack = [...childrenOf(index, id)];
  const seen = new Set<string>();
  while (stack.length) {
    const node = stack.pop();
    if (!node || seen.has(node.id)) continue;
    seen.add(node.id);
    out.push(node);
    stack.push(...childrenOf(index, node.id));
  }
  return out;
}

export function ancestors(index: SceneIndex, id: string): SceneObject[] {
  const out: SceneObject[] = [];
  let cursor = index.byId.get(id)?.parent_id ?? null;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const parent = index.byId.get(cursor);
    if (!parent) break;
    out.push(parent);
    cursor = parent.parent_id;
  }
  return out;
}

/** Human readable path, e.g. "Character_Boy / Head / Hair". */
export function objectPath(index: SceneIndex, id: string): string {
  const obj = index.byId.get(id);
  if (!obj) return "unknown";
  return [...ancestors(index, id).reverse().map((a) => a.name), obj.name].join(" / ");
}

export function wouldCreateCycle(index: SceneIndex, objectId: string, newParentId: string | null): boolean {
  if (newParentId === null) return false;
  if (newParentId === objectId) return true;
  return descendants(index, objectId).some((d) => d.id === newParentId);
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export interface ObjectMatch {
  object: SceneObject;
  score: number;
}

/**
 * Deterministic name/tag/type search used by the NL planner to resolve
 * references such as "the apple" or "his hair". Scores are 0..1.
 */
export function searchObjects(scene: SceneDocument, query: string, limit = 10): ObjectMatch[] {
  const index = indexScene(scene);
  const q = normalise(query);
  if (!q) return [];
  const words = q.split(" ").filter((w) => w.length > 1);
  const matches: ObjectMatch[] = [];

  for (const obj of scene.objects) {
    const name = normalise(obj.name);
    const tags = obj.tags.map(normalise);
    let score = 0;

    if (name === q) score = 1;
    else if (name.includes(q)) score = 0.85;
    else if (q.includes(name)) score = 0.7;
    else {
      const hits = words.filter((w) => name.includes(w) || tags.some((t) => t.includes(w)));
      if (hits.length) score = 0.35 + 0.4 * (hits.length / words.length);
      else if (tags.some((t) => q.includes(t))) score = 0.4;
    }

    if (score > 0) {
      // Prefer leaves over containers when names collide, and prefer objects
      // whose full path matches (e.g. "his hair" -> Head/Hair, not the head).
      const path = normalise(objectPath(index, obj.id));
      if (path.includes(q)) score = Math.min(1, score + 0.05);
      if (obj.type === "group" || obj.type === "environment") score -= 0.1;
      matches.push({ object: obj, score: Math.max(0.05, Math.min(1, score)) });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function objectsByType(scene: SceneDocument, types: ObjectType[]): SceneObject[] {
  const set = new Set(types);
  return scene.objects.filter((o) => set.has(o.type));
}

export function sceneStats(scene: SceneDocument) {
  const byType: Record<string, number> = {};
  let hidden = 0;
  let locked = 0;
  let protectedCount = 0;
  for (const obj of scene.objects) {
    byType[obj.type] = (byType[obj.type] ?? 0) + 1;
    if (!obj.visible) hidden += 1;
    if (obj.locked) locked += 1;
    if (obj.protected) protectedCount += 1;
  }
  return {
    objects: scene.objects.length,
    byType,
    hidden,
    locked,
    protected: protectedCount,
    animations: scene.animations.length,
    shots: scene.shots.length,
    duration_frames: scene.settings.duration_frames,
    fps: scene.settings.fps,
  };
}

/** Flat list for tree UIs: depth-first, parents before children. */
export function flattenTree(index: SceneIndex): { object: SceneObject; depth: number }[] {
  const out: { object: SceneObject; depth: number }[] = [];
  const walk = (nodes: SceneObject[], depth: number) => {
    for (const node of nodes) {
      out.push({ object: node, depth });
      walk(childrenOf(index, node.id), depth + 1);
    }
  };
  walk(index.roots, 0);
  return out;
}
