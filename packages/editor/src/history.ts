import { newId, type SceneDocument } from "@ai3d/scene-core";

export interface HistoryEntry {
  id: string;
  label: string;
  kind: "manual" | "ai_plan" | "import" | "restore" | "branch";
  timestamp: string;
  revision: number;
  planId?: string;
  prompt?: string;
  touched: string[];
  /** Full document snapshot: the source of truth for undo and variations. */
  snapshot: SceneDocument;
}

export interface HistoryState {
  entries: HistoryEntry[];
  cursor: number;
}

export const MAX_HISTORY = 100;

/**
 * Non-destructive history. Every entry stores a full document snapshot, so undo
 * is exact, branching is cheap and a failed operation can always be recovered
 * from the last good entry.
 */
export class SceneHistory {
  private entries: HistoryEntry[] = [];
  private cursor = -1;

  constructor(private readonly limit = MAX_HISTORY) {}

  reset(scene: SceneDocument, label = "Open scene"): void {
    this.entries = [this.makeEntry(scene, label, "import", [], {})];
    this.cursor = 0;
  }

  private makeEntry(
    scene: SceneDocument,
    label: string,
    kind: HistoryEntry["kind"],
    touched: string[],
    extra: Partial<HistoryEntry>,
  ): HistoryEntry {
    return {
      id: newId("hist"),
      label,
      kind,
      timestamp: new Date().toISOString(),
      revision: scene.revision,
      touched,
      snapshot: structuredClone(scene),
      ...extra,
    };
  }

  /** Records a new state. Drops any redo branch ahead of the cursor. */
  push(
    scene: SceneDocument,
    label: string,
    kind: HistoryEntry["kind"] = "manual",
    touched: string[] = [],
    extra: Partial<HistoryEntry> = {},
  ): HistoryEntry {
    this.entries = this.entries.slice(0, this.cursor + 1);
    const entry = this.makeEntry(scene, label, kind, touched, extra);
    this.entries.push(entry);
    if (this.entries.length > this.limit) this.entries.shift();
    this.cursor = this.entries.length - 1;
    return entry;
  }

  canUndo(): boolean {
    return this.cursor > 0;
  }

  canRedo(): boolean {
    return this.cursor < this.entries.length - 1;
  }

  undo(): SceneDocument | null {
    if (!this.canUndo()) return null;
    this.cursor -= 1;
    return structuredClone(this.current()!.snapshot);
  }

  redo(): SceneDocument | null {
    if (!this.canRedo()) return null;
    this.cursor += 1;
    return structuredClone(this.current()!.snapshot);
  }

  current(): HistoryEntry | null {
    return this.entries[this.cursor] ?? null;
  }

  /** Jump to any point in history (used by the version timeline UI). */
  jumpTo(entryId: string): SceneDocument | null {
    const i = this.entries.findIndex((e) => e.id === entryId);
    if (i === -1) return null;
    this.cursor = i;
    return structuredClone(this.entries[i]!.snapshot);
  }

  /** Creates a variation: a copy of the scene as a new branch point. */
  branch(entryId: string, name: string): { scene: SceneDocument; entry: HistoryEntry } | null {
    const i = this.entries.findIndex((e) => e.id === entryId);
    if (i === -1) return null;
    const source = structuredClone(this.entries[i]!.snapshot);
    source.id = newId("scn");
    source.name = name;
    source.revision = 0;
    source.updated_at = new Date().toISOString();
    const entry = this.push(source, `Branch: ${name}`, "branch", []);
    return { scene: source, entry };
  }

  list(): HistoryEntry[] {
    return this.entries.map((e) => ({ ...e, snapshot: undefined as unknown as SceneDocument }));
  }

  cursorIndex(): number {
    return this.cursor;
  }

  /** Compact diff summary between the cursor and the previous entry. */
  lastChange(): { added: string[]; removed: string[]; changed: string[] } | null {
    if (this.cursor < 1) return null;
    const before = this.entries[this.cursor - 1]!.snapshot;
    const after = this.entries[this.cursor]!.snapshot;
    const beforeMap = new Map(before.objects.map((o) => [o.id, o]));
    const afterMap = new Map(after.objects.map((o) => [o.id, o]));
    const added = [...afterMap.keys()].filter((id) => !beforeMap.has(id));
    const removed = [...beforeMap.keys()].filter((id) => !afterMap.has(id));
    const changed = [...afterMap.keys()].filter((id) => {
      const b = beforeMap.get(id);
      const a = afterMap.get(id);
      return b && a && b.version !== a.version;
    });
    return { added, removed, changed };
  }
}
