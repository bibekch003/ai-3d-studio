"use client";

import { create } from "zustand";
import {
  applyEditOperation,
  applyPlan,
  SceneHistory,
  SelectionModel,
  type HistoryEntry,
  type SelectionMode,
} from "@ai3d/editor";
import {
  buildDemoScene,
  validateEditPlan,
  validateScene,
  type EditOperation,
  type EditPlan,
  type SceneDocument,
  type ValidationIssue,
} from "@ai3d/scene-core";

export type WorkspaceMode = "beginner" | "professional";

/**
 * One history instance per browser session. It holds full snapshots, so undo is
 * exact and every AI edit is traceable back to the prompt that produced it.
 */
const history = new SceneHistory(60);
const selection = new SelectionModel(buildDemoScene());

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "success" | "warning" | "danger";
}

export interface StudioStore {
  scene: SceneDocument;
  selection: string[];
  hovered: string | null;
  mode: WorkspaceMode;
  frame: number;
  playing: boolean;
  gizmo: "translate" | "rotate" | "scale";
  pendingPlan: EditPlan | null;
  planSource: "local" | "server" | null;
  planErrors: ValidationIssue[];
  planWarnings: ValidationIssue[];
  toasts: Toast[];
  historyVersion: number;
  historyIndex: number;
  historyLength: number;
  dirty: boolean;

  init: (scene?: SceneDocument) => void;
  setScene: (scene: SceneDocument) => void;
  select: (id: string | null, mode?: SelectionMode) => void;
  selectMany: (ids: string[], mode?: SelectionMode) => void;
  selectSubtree: (id: string) => void;
  selectByType: (type: Parameters<SelectionModel["selectByType"]>[0]) => void;
  selectByQuery: (query: string) => { id: string; name: string; score: number }[];
  hover: (id: string | null) => void;
  clearSelection: () => void;

  applyOps: (ops: EditOperation[], label: string) => boolean;
  setPlan: (plan: EditPlan | null, source?: "local" | "server") => void;
  applyPendingPlan: () => boolean;
  discardPlan: () => void;

  undo: () => void;
  redo: () => void;
  jumpTo: (entryId: string) => void;
  branch: (name: string) => void;
  historyList: () => HistoryEntry[];

  setFrame: (frame: number) => void;
  setPlaying: (playing: boolean) => void;
  setMode: (mode: WorkspaceMode) => void;
  setGizmo: (gizmo: StudioStore["gizmo"]) => void;
  notify: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;
  markSaved: () => void;
}

let toastSeq = 0;

const initialScene = buildDemoScene();
history.reset(initialScene, "Open demo scene");

export const useStudio = create<StudioStore>()((set, get) => ({
  scene: initialScene,
  selection: [],
  hovered: null,
  mode: "professional",
  frame: 0,
  playing: false,
  gizmo: "translate",
  pendingPlan: null,
  planSource: null,
  planErrors: [],
  planWarnings: [],
  toasts: [],
  historyVersion: 0,
  historyIndex: 0,
  historyLength: 1,
  dirty: false,

  init: (scene) => {
    const next = scene ?? buildDemoScene();
    selection.setScene(next);
    history.reset(next, scene ? "Open scene" : "Open demo scene");
    set({
      scene: next,
      selection: [],
      hovered: null,
      frame: 0,
      playing: false,
      pendingPlan: null,
      dirty: false,
      historyVersion: get().historyVersion + 1,
      historyIndex: history.cursorIndex(),
      historyLength: history.list().length,
    });
  },

  setScene: (scene) => {
    selection.setScene(scene);
    set({ scene, selection: selection.get().selectedIds, dirty: true });
  },

  select: (id, mode = "replace") => {
    if (!id) {
      selection.clear();
    } else {
      selection.select([id], mode);
    }
    set({ selection: selection.get().selectedIds });
  },

  selectMany: (ids, mode = "replace") => {
    selection.select(ids, mode);
    set({ selection: selection.get().selectedIds });
  },

  selectSubtree: (id) => {
    selection.selectSubtree(id);
    set({ selection: selection.get().selectedIds });
  },

  selectByType: (type) => {
    selection.selectByType(type);
    set({ selection: selection.get().selectedIds });
  },

  selectByQuery: (query) => {
    const res = selection.selectByQuery(query);
    set({ selection: res.state.selectedIds });
    return res.candidates;
  },

  hover: (id) => {
    selection.hover(id);
    set({ hovered: id });
  },

  clearSelection: () => {
    selection.clear();
    set({ selection: [] });
  },

  applyOps: (ops, label) => {
    let working = get().scene;
    const touched: string[] = [];
    try {
      for (const op of ops) {
        const res = applyEditOperation(working, op);
        working = res.scene;
        touched.push(...res.touched);
      }
    } catch (error) {
      get().notify(error instanceof Error ? error.message : "Edit failed", "danger");
      return false;
    }
    const validation = validateScene(working);
    if (!validation.ok) {
      get().notify(`Edit rejected: ${validation.errors[0]?.message ?? "invalid scene"}`, "danger");
      return false;
    }
    selection.setScene(working);
    history.push(working, label, "manual", touched);
    set({
      scene: working,
      dirty: true,
      historyVersion: get().historyVersion + 1,
      historyIndex: history.cursorIndex(),
      historyLength: history.list().length,
    });
    return true;
  },

  setPlan: (plan, source = "local") => {
    if (!plan) {
      set({ pendingPlan: null, planSource: null, planErrors: [], planWarnings: [] });
      return;
    }
    const validation = validateEditPlan(plan, get().scene);
    set({
      pendingPlan: plan,
      planSource: source,
      planErrors: validation.errors,
      planWarnings: validation.warnings,
    });
  },

  applyPendingPlan: () => {
    const plan = get().pendingPlan;
    if (!plan) return false;
    const result = applyPlan(get().scene, plan);
    if (!result.ok) {
      set({ planErrors: result.errors.map((message) => ({ code: "apply_failed", message, severity: "error" as const })) });
      get().notify("Plan could not be applied", "danger");
      return false;
    }
    selection.setScene(result.scene);
    history.push(result.scene, plan.summary, "ai_plan", result.touched, {
      planId: plan.id,
      prompt: plan.prompt,
    });
    set({
      scene: result.scene,
      pendingPlan: null,
      planSource: null,
      planErrors: [],
      planWarnings: [],
      dirty: true,
      historyVersion: get().historyVersion + 1,
      historyIndex: history.cursorIndex(),
      historyLength: history.list().length,
    });
    get().notify(`Applied: ${plan.summary}`, "success");
    return true;
  },

  discardPlan: () => set({ pendingPlan: null, planSource: null, planErrors: [], planWarnings: [] }),

  undo: () => {
    const scene = history.undo();
    if (!scene) return;
    selection.setScene(scene);
    set({
      scene,
      selection: selection.get().selectedIds,
      dirty: true,
      historyVersion: get().historyVersion + 1,
      historyIndex: history.cursorIndex(),
    });
  },

  redo: () => {
    const scene = history.redo();
    if (!scene) return;
    selection.setScene(scene);
    set({
      scene,
      selection: selection.get().selectedIds,
      dirty: true,
      historyVersion: get().historyVersion + 1,
      historyIndex: history.cursorIndex(),
    });
  },

  jumpTo: (entryId) => {
    const scene = history.jumpTo(entryId);
    if (!scene) return;
    selection.setScene(scene);
    set({
      scene,
      selection: selection.get().selectedIds,
      historyVersion: get().historyVersion + 1,
      historyIndex: history.cursorIndex(),
    });
  },

  branch: (name) => {
    const current = history.current();
    if (!current) return;
    const branch = history.branch(current.id, name);
    if (!branch) return;
    selection.setScene(branch.scene);
    set({
      scene: branch.scene,
      selection: [],
      dirty: true,
      historyVersion: get().historyVersion + 1,
      historyIndex: history.cursorIndex(),
      historyLength: history.list().length,
    });
    get().notify(`Created variation "${name}"`, "success");
  },

  historyList: () => history.list(),

  setFrame: (frame) => set({ frame: Math.max(0, Math.min(get().scene.settings.duration_frames, Math.round(frame))) }),
  setPlaying: (playing) => set({ playing }),
  setMode: (mode) => set({ mode }),
  setGizmo: (gizmo) => set({ gizmo }),

  notify: (message, tone = "info") => {
    toastSeq += 1;
    const toast: Toast = { id: toastSeq, message, tone };
    set({ toasts: [...get().toasts.slice(-3), toast] });
    setTimeout(() => get().dismissToast(toast.id), 5200);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  markSaved: () => set({ dirty: false }),
}));

export function primarySelection(scene: SceneDocument, ids: string[]) {
  const id = ids[0];
  if (!id) return null;
  return scene.objects.find((o) => o.id === id) ?? null;
}
