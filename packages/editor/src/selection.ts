import {
  childrenOf,
  descendants,
  indexScene,
  searchObjects,
  type ObjectType,
  type SceneDocument,
  type SceneIndex,
} from "@ai3d/scene-core";

export interface SelectionState {
  selectedIds: string[];
  hoveredId: string | null;
  /** Anchor for shift-range selection in the hierarchy tree. */
  anchorId: string | null;
}

export const EMPTY_SELECTION: SelectionState = { selectedIds: [], hoveredId: null, anchorId: null };

export type SelectionMode = "replace" | "add" | "toggle";

/**
 * Selection model shared by viewport raycasts, the hierarchy tree and the AI
 * selection list. It is deliberately a plain data structure so it can live in a
 * Zustand store and be serialised into undo entries.
 */
export class SelectionModel {
  private state: SelectionState = { ...EMPTY_SELECTION };
  private index: SceneIndex | null = null;

  constructor(private scene?: SceneDocument) {
    if (scene) this.index = indexScene(scene);
  }

  setScene(scene: SceneDocument): void {
    this.index = indexScene(scene);
    const alive = new Set(scene.objects.map((o) => o.id));
    this.state.selectedIds = this.state.selectedIds.filter((id) => alive.has(id));
    if (this.state.hoveredId && !alive.has(this.state.hoveredId)) this.state.hoveredId = null;
  }

  get(): SelectionState {
    return { ...this.state, selectedIds: [...this.state.selectedIds] };
  }

  primary(): string | null {
    return this.state.selectedIds[0] ?? null;
  }

  isSelected(id: string): boolean {
    return this.state.selectedIds.includes(id);
  }

  hover(id: string | null): void {
    this.state.hoveredId = id;
  }

  select(ids: string[], mode: SelectionMode = "replace"): SelectionState {
    const incoming = ids.filter(Boolean);
    if (mode === "replace") {
      this.state.selectedIds = [...new Set(incoming)];
    } else if (mode === "add") {
      this.state.selectedIds = [...new Set([...this.state.selectedIds, ...incoming])];
    } else {
      const set = new Set(this.state.selectedIds);
      for (const id of incoming) {
        if (set.has(id)) set.delete(id);
        else set.add(id);
      }
      this.state.selectedIds = [...set];
    }
    this.state.anchorId = incoming[incoming.length - 1] ?? this.state.anchorId;
    return this.get();
  }

  clear(): SelectionState {
    this.state.selectedIds = [];
    this.state.anchorId = null;
    return this.get();
  }

  /** Select the object plus every descendant (e.g. whole character). */
  selectSubtree(id: string, mode: SelectionMode = "replace"): SelectionState {
    if (!this.index) return this.get();
    return this.select([id, ...descendants(this.index, id).map((d) => d.id)], mode);
  }

  selectChildren(id: string, mode: SelectionMode = "add"): SelectionState {
    if (!this.index) return this.get();
    return this.select(childrenOf(this.index, id).map((c) => c.id), mode);
  }

  selectParent(id: string, mode: SelectionMode = "replace"): SelectionState {
    const parent = this.index?.byId.get(id)?.parent_id ?? null;
    return parent ? this.select([parent], mode) : this.get();
  }

  /** "Select all objects of a category" - the AI selection primitive. */
  selectByType(type: ObjectType | ObjectType[], mode: SelectionMode = "replace"): SelectionState {
    if (!this.scene) return this.get();
    const types = new Set(Array.isArray(type) ? type : [type]);
    return this.select(this.scene.objects.filter((o) => types.has(o.type)).map((o) => o.id), mode);
  }

  selectAll(mode: SelectionMode = "replace"): SelectionState {
    if (!this.scene) return this.get();
    return this.select(this.scene.objects.map((o) => o.id), mode);
  }

  /** Natural-language selection: "the apple", "all plants". */
  selectByQuery(query: string, mode: SelectionMode = "replace"): { state: SelectionState; candidates: { id: string; name: string; score: number }[] } {
    if (!this.scene) return { state: this.get(), candidates: [] };
    const matches = searchObjects(this.scene, query, 8);
    const strong = matches.filter((m) => m.score >= 0.55);
    const chosen = strong.length ? strong : matches.slice(0, 1);
    return {
      state: this.select(chosen.map((m) => m.object.id), mode),
      candidates: matches.map((m) => ({ id: m.object.id, name: m.object.name, score: Number(m.score.toFixed(2)) })),
    };
  }
}
