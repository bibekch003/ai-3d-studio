"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  applyEditOperation,
  applyPlan,
  SceneHistory,
  SelectionModel,
  type HistoryEntry,
  type SelectionMode,
} from "@ai3d/editor";
import {
  buildBlankScene,
  buildDemoScene,
  buildSceneFromPrompt,
  validateEditPlan,
  validateScene,
  type EditOperation,
  type EditPlan,
  type EnvironmentSettings,
  type SceneDocument,
  type ScenePlan,
  type SceneSettings,
  type ValidationIssue,
} from "@ai3d/scene-core";

export type WorkspaceMode = "beginner" | "professional";
export type SceneSource = "demo" | "blank" | "prompt" | "director" | "restored" | "saved";

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

const SAVED_KEY = "ai3d.saved-scene";

/** Storage that works in the browser, during SSR and under test runners. */
const safeStorage = createJSONStorage(() => {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  const memory = new Map<string, string>();
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
    removeItem: (key: string) => void memory.delete(key),
  } as unknown as Storage;
});

export interface StudioStore {
  scene: SceneDocument;
  sceneSource: SceneSource;
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
  hasSavedScene: boolean;

  init: (scene?: SceneDocument, source?: SceneSource) => void;
  newScene: (kind: "demo" | "blank" | "prompt", prompt?: string) => { ok: boolean; warnings: string[] };
  loadDirectorPlan: (plan: ScenePlan) => void;
  setScene: (scene: SceneDocument, source?: SceneSource) => void;
  select: (id: string | null, mode?: SelectionMode) => void;
  selectMany: (ids: string[], mode?: SelectionMode) => void;
  selectSubtree: (id: string) => void;
  selectByType: (type: Parameters<SelectionModel["selectByType"]>[0]) => void;
  selectByQuery: (query: string) => { id: string; name: string; score: number }[];
  hover: (id: string | null) => void;
  clearSelection: () => void;

  applyOps: (ops: EditOperation[], label: string) => boolean;
  patchSettings: (patch: Partial<SceneSettings>, label?: string) => void;
  patchEnvironment: (patch: Partial<EnvironmentSettings>, label?: string) => void;
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
  saveToBrowser: () => boolean;
  restoreFromBrowser: () => boolean;
}

let toastSeq = 0;

const initialScene = buildDemoScene();
history.reset(initialScene, "Open demo scene");

function afterSceneChange(scene: SceneDocument, set: (partial: Partial<StudioStore>) => void, get: () => StudioStore) {
  selection.setScene(scene);
  set({
    scene,
    selection: selection.get().selectedIds,
    dirty: true,
    historyVersion: get().historyVersion + 1,
    historyIndex: history.cursorIndex(),
    historyLength: history.list().length,
  });
}

export const useStudio = create<StudioStore>()(
  persist(
    (set, get) => ({
      scene: initialScene,
      sceneSource: "demo",
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
      hasSavedScene: false,

      init: (scene, source = "demo") => {
        const next = scene ?? buildDemoScene();
        selection.setScene(next);
        history.reset(next, source === "blank" ? "New empty stage" : "Open scene");
        set({
          scene: next,
          sceneSource: source,
          selection: [],
          hovered: null,
          frame: 0,
          playing: false,
          pendingPlan: null,
          planErrors: [],
          planWarnings: [],
          dirty: false,
          historyVersion: get().historyVersion + 1,
          historyIndex: history.cursorIndex(),
          historyLength: history.list().length,
        });
      },

      newScene: (kind, prompt) => {
        if (kind === "demo") {
          get().init(buildDemoScene(), "demo");
          get().notify("Loaded the demo scene", "success");
          return { ok: true, warnings: [] };
        }
        if (kind === "blank") {
          get().init(buildBlankScene(), "blank");
          get().notify("Empty stage created — add objects or describe a scene", "success");
          return { ok: true, warnings: [] };
        }
        const text = (prompt ?? "").trim();
        if (text.length < 8) {
          get().notify("Describe the scene in a sentence or two first", "warning");
          return { ok: false, warnings: ["Prompt too short"] };
        }
        const { scene, warnings } = buildSceneFromPrompt(text);
        get().init(scene, "prompt");
        const objectCount = scene.objects.length;
        get().notify(`Built a scene with ${objectCount} objects from your description`, "success");
        return { ok: true, warnings };
      },

      loadDirectorPlan: (plan) => {
        const result = get().newScene("prompt", plan.prompt);
        if (result.ok) {
          get().notify(`Director plan "${plan.logline.slice(0, 60)}…" applied`, "success");
          set({ sceneSource: "director" });
        }
      },

      setScene: (scene, source = "restored") => {
        selection.setScene(scene);
        history.push(scene, "Load scene", "import", []);
        set({
          scene,
          sceneSource: source,
          selection: selection.get().selectedIds,
          historyVersion: get().historyVersion + 1,
          historyIndex: history.cursorIndex(),
          historyLength: history.list().length,
        });
      },

      select: (id, mode = "replace") => {
        if (!id) selection.clear();
        else selection.select([id], mode);
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
        history.push(working, label, "manual", touched);
        afterSceneChange(working, set, get);
        return true;
      },

      patchSettings: (patch, label = "Scene settings") => {
        const working = structuredClone(get().scene);
        working.settings = { ...working.settings, ...patch };
        working.revision += 1;
        working.updated_at = new Date().toISOString();
        history.push(working, label, "manual", []);
        afterSceneChange(working, set, get);
      },

      patchEnvironment: (patch, label = "Environment") => {
        const working = structuredClone(get().scene);
        working.environment = { ...working.environment, ...patch };
        working.revision += 1;
        working.updated_at = new Date().toISOString();
        history.push(working, label, "manual", []);
        afterSceneChange(working, set, get);
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
          pendingPlan: null,
          planSource: null,
          planErrors: [],
          planWarnings: [],
          dirty: true,
          historyVersion: get().historyVersion + 1,
          historyIndex: history.cursorIndex(),
          historyLength: history.list().length,
          scene: result.scene,
          selection: selection.get().selectedIds,
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
          sceneSource: "restored",
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

      saveToBrowser: () => {
        if (typeof window === "undefined") return false;
        try {
          window.localStorage.setItem(SAVED_KEY, JSON.stringify(get().scene));
          set({ dirty: false, hasSavedScene: true });
          get().notify("Saved to this browser (no account needed)", "success");
          return true;
        } catch {
          get().notify("Browser storage is full or blocked; could not save", "danger");
          return false;
        }
      },

      restoreFromBrowser: () => {
        if (typeof window === "undefined") return false;
        const raw = window.localStorage.getItem(SAVED_KEY);
        if (!raw) {
          get().notify("No saved scene in this browser yet", "warning");
          return false;
        }
        try {
          const parsed = JSON.parse(raw) as SceneDocument;
          const validation = validateScene(parsed);
          if (!validation.ok) {
            get().notify("Saved scene is invalid and was not loaded", "danger");
            return false;
          }
          get().init(validation.data ?? parsed, "saved");
          get().notify("Restored your saved scene", "success");
          return true;
        } catch {
          get().notify("Saved scene could not be read", "danger");
          return false;
        }
      },
    }),
    {
      name: "ai3d-studio-state",
      storage: safeStorage,
      partialize: (state) => ({ scene: state.scene, mode: state.mode, sceneSource: state.sceneSource }),
      onRehydrateStorage: () => (state) => {
        if (!state?.scene) return;
        const validation = validateScene(state.scene);
        if (!validation.ok) return;
        selection.setScene(state.scene);
        history.reset(state.scene, "Restored session");
      },
    },
  ),
);

export function primarySelection(scene: SceneDocument, ids: string[]) {
  const id = ids[0];
  if (!id) return null;
  return scene.objects.find((o) => o.id === id) ?? null;
}
