"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Tabs, cn } from "@ai3d/ui";
import { SceneTree } from "@/components/studio/SceneTree";
import { Inspector } from "@/components/studio/Inspector";
import { AIPanel } from "@/components/studio/AIPanel";
import { HistoryPanel } from "@/components/studio/HistoryPanel";
import { Timeline } from "@/components/studio/Timeline";
import { Toasts } from "@/components/studio/Toasts";
import { useStudio } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { isApiConfigured, productName } from "@/lib/product";
import { downloadDataUrl, downloadUrl, useViewportRecorder } from "@/lib/recorder";
import { captureStill } from "@/lib/viewport-bridge";

const Viewport = dynamic(() => import("@/components/studio/Viewport"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-studio-950 text-xs text-neutral-500">Loading 3D viewport…</div>,
});

type RightTab = "inspect" | "ai" | "history";

const SOURCE_LABEL: Record<string, string> = {
  demo: "demo scene",
  blank: "empty stage",
  prompt: "from description",
  director: "director plan",
  restored: "restored",
  saved: "saved",
};

export default function StudioPage() {
  const scene = useStudio((s) => s.scene);
  const sceneSource = useStudio((s) => s.sceneSource);
  const dirty = useStudio((s) => s.dirty);
  const gizmo = useStudio((s) => s.gizmo);
  const setGizmo = useStudio((s) => s.setGizmo);
  const mode = useStudio((s) => s.mode);
  const setMode = useStudio((s) => s.setMode);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const selection = useStudio((s) => s.selection);
  const historyIndex = useStudio((s) => s.historyIndex);
  const historyLength = useStudio((s) => s.historyLength);
  const notify = useStudio((s) => s.notify);
  const markSaved = useStudio((s) => s.markSaved);
  const newScene = useStudio((s) => s.newScene);
  const saveToBrowser = useStudio((s) => s.saveToBrowser);
  const restoreFromBrowser = useStudio((s) => s.restoreFromBrowser);
  const setPlaying = useStudio((s) => s.setPlaying);
  const setFrame = useStudio((s) => s.setFrame);

  const [tab, setTab] = useState<RightTab>("inspect");
  const [saving, setSaving] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [sceneMenu, setSceneMenu] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const recorder = useViewportRecorder();
  const bridged = useRef(false);

  // Director hand-off: the AI Director page stores a plan here and routes to the studio.
  useEffect(() => {
    if (bridged.current) return;
    bridged.current = true;
    try {
      const raw = sessionStorage.getItem("ai3d.pendingPlan");
      if (raw) {
        const payload = JSON.parse(raw) as { prompt?: string };
        sessionStorage.removeItem("ai3d.pendingPlan");
        if (payload.prompt) {
          const result = newScene("prompt", payload.prompt);
          notify(
            result.ok ? "Director plan built a new scene — edit anything you like" : "Director plan could not be applied",
            result.ok ? "success" : "warning",
          );
        }
      }
    } catch {
      /* malformed hand-off is ignored rather than crashing the studio */
    }
    try {
      if (!localStorage.getItem("ai3d.studio-seen")) setShowHint(true);
    } catch {
      /* storage blocked */
    }
  }, [newScene, notify]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.key === "1") setGizmo("translate");
      if (e.key === "2") setGizmo("rotate");
      if (e.key === "3") setGizmo("scale");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, setGizmo]);

  async function save() {
    if (!isApiConfigured) {
      saveToBrowser();
      return;
    }
    setSaving(true);
    try {
      await api.saveScene(scene);
      markSaved();
      notify(`Saved revision ${scene.revision}`, "success");
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 409
          ? "Someone else saved a newer revision. Reload before saving again."
          : error instanceof Error
            ? error.message
            : "Save failed";
      notify(message, "danger");
    } finally {
      setSaving(false);
    }
  }

  function record() {
    const seconds = Math.min(20, Math.max(3, scene.settings.duration_frames / scene.settings.fps));
    setFrame(0);
    setPlaying(true);
    const started = recorder.start(seconds, () => undefined);
    if (!started) setPlaying(false);
  }

  useEffect(() => {
    if (!recorder.recording && recorder.url) setPlaying(false);
  }, [recorder.recording, recorder.url, setPlaying]);

  function snapshot() {
    const dataUrl = captureStill();
    if (!dataUrl) {
      notify("Viewport not ready yet — try again once the scene has loaded", "warning");
      return;
    }
    downloadDataUrl(dataUrl, `${scene.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-frame-${Math.round(useStudio.getState().frame)}.png`);
    notify("Frame saved as PNG", "success");
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-studio-950">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-studio-800 px-2">
        <Link href="/dashboard" className="flex items-center gap-1.5 pr-2" title="Back to dashboard">
          <span className="grid size-5 place-items-center rounded bg-amber-400 text-[10px] font-black text-neutral-950">3D</span>
          <span className="hidden text-xs font-semibold text-neutral-200 sm:block">{productName}</span>
        </Link>

        <div className="relative">
          <button
            type="button"
            onClick={() => setSceneMenu((v) => !v)}
            aria-expanded={sceneMenu}
            className="flex items-center gap-1.5 rounded border border-studio-700 px-2 py-1 text-xs text-neutral-200 hover:bg-studio-800"
          >
            <span className="max-w-40 truncate">{scene.name}</span>
            <span className="text-[9px] text-neutral-500">▾</span>
          </button>
          {sceneMenu ? (
            <div className="absolute left-0 top-9 z-40 w-64 rounded-lg border border-studio-700 bg-studio-900 p-1 shadow-xl">
              <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-neutral-500">Scene</p>
              {[
                ["Demo scene (boy + apple)", () => newScene("demo")],
                ["Empty stage", () => newScene("blank")],
                ["Restore my saved scene", () => restoreFromBrowser()],
              ].map(([label, action]) => (
                <button
                  key={String(label)}
                  type="button"
                  onClick={() => {
                    (action as () => void)();
                    setSceneMenu(false);
                  }}
                  className="block w-full rounded px-2 py-1.5 text-left text-xs text-neutral-300 hover:bg-studio-800 hover:text-neutral-100"
                >
                  {String(label)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setTab("ai");
                  setSceneMenu(false);
                  notify("Type a description in the New scene tab", "info");
                }}
                className="block w-full rounded px-2 py-1.5 text-left text-xs text-amber-300 hover:bg-studio-800"
              >
                New scene from description…
              </button>
              <div className="mt-1 border-t border-studio-800 px-2 py-1 text-[10px] text-neutral-500">
                source: {SOURCE_LABEL[sceneSource] ?? sceneSource} · rev {scene.revision}
              </div>
            </div>
          ) : null}
        </div>

        <div className="ml-1 flex items-center gap-1">
          <button type="button" onClick={undo} disabled={historyIndex <= 0} className="rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-studio-800 hover:text-neutral-100 disabled:opacity-30" title="Undo (Ctrl+Z)">
            ↶
          </button>
          <button type="button" onClick={redo} disabled={historyIndex >= historyLength - 1} className="rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-studio-800 hover:text-neutral-100 disabled:opacity-30" title="Redo">
            ↷
          </button>
          {mode === "professional" ? (
            <span className="ml-1 flex overflow-hidden rounded border border-studio-700">
              {(["translate", "rotate", "scale"] as const).map((g, i) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGizmo(g)}
                  title={`${g} (${i + 1})`}
                  className={cn("px-2 py-0.5 text-[10px]", gizmo === g ? "bg-amber-400 text-neutral-950" : "text-neutral-400 hover:bg-studio-800")}
                >
                  {g === "translate" ? "Move" : g === "rotate" ? "Rotate" : "Scale"}
                </button>
              ))}
            </span>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode(mode === "beginner" ? "professional" : "beginner")}
            className="rounded border border-studio-700 px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-studio-800"
            title="Beginner mode hides advanced controls"
          >
            {mode === "beginner" ? "Beginner" : "Professional"}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={record}
              disabled={recorder.recording}
              className="rounded border border-studio-700 px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-studio-800 disabled:opacity-50"
              title="Record the viewport to a WebM file (preview quality, not a Blender render)"
            >
              {recorder.recording ? `● ${Math.round(recorder.progress * 100)}%` : "Record"}
            </button>
            {recorder.url && !recorder.recording ? (
              <button
                type="button"
                onClick={() => downloadUrl(recorder.url!, `${scene.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.webm`)}
                className="ml-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200 hover:bg-emerald-500/30"
              >
                Download {recorder.sizeMb} MB
              </button>
            ) : null}
          </div>

          <button type="button" onClick={snapshot} className="rounded border border-studio-700 px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-studio-800" title="Save the current frame as PNG">
            Still
          </button>

          <Badge tone={selection.length ? "info" : "neutral"}>{selection.length} selected</Badge>
          <Button size="sm" variant="subtle" onClick={() => void save()} loading={saving}>
            {isApiConfigured ? "Save" : "Save local"}
          </Button>
          <Link href="/rendering" className="rounded-md bg-amber-400 px-2.5 py-1 text-[11px] font-semibold text-neutral-950 hover:bg-amber-300">
            Render
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className={cn("shrink-0 border-r border-studio-800 bg-studio-900/60 transition-all", leftOpen ? "w-60" : "w-0 overflow-hidden")}>
          <div className="flex h-8 items-center justify-between border-b border-studio-800 px-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Scene</span>
            <button type="button" onClick={() => setLeftOpen(false)} className="text-[10px] text-neutral-500 hover:text-neutral-200" aria-label="Collapse scene panel">
              ‹
            </button>
          </div>
          <div className="h-[calc(100%-2rem)]">
            <SceneTree />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            {!leftOpen ? (
              <button
                type="button"
                onClick={() => setLeftOpen(true)}
                className="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-r bg-studio-800 px-1 py-3 text-[10px] text-neutral-300"
                aria-label="Expand scene panel"
              >
                ›
              </button>
            ) : null}
            <Viewport />
            {recorder.error ? (
              <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-red-950/90 px-3 py-1 text-[10px] text-red-200">{recorder.error}</p>
            ) : null}
          </div>
          <div className={cn("shrink-0 border-t border-studio-800", mode === "beginner" ? "h-32" : "h-48")}>
            <Timeline />
          </div>
        </div>

        <aside className="flex w-80 shrink-0 flex-col border-l border-studio-800 bg-studio-900/60">
          <div className="border-b border-studio-800 p-1.5">
            <Tabs
              tabs={
                mode === "beginner"
                  ? [
                      { id: "inspect", label: "Inspect" },
                      { id: "ai", label: "AI" },
                    ]
                  : [
                      { id: "inspect", label: "Inspect" },
                      { id: "ai", label: "AI edit" },
                      { id: "history", label: "History" },
                    ]
              }
              active={tab === "history" && mode === "beginner" ? "inspect" : tab}
              onChange={(id) => setTab(id as RightTab)}
            />
          </div>
          <div className="min-h-0 flex-1">
            {tab === "inspect" || (tab === "history" && mode === "beginner") ? <Inspector /> : null}
            {tab === "ai" ? <AIPanel /> : null}
            {tab === "history" && mode === "professional" ? <HistoryPanel /> : null}
          </div>
        </aside>
      </div>

      {showHint ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-neutral-950/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-studio-700 bg-studio-900 p-5">
            <h2 className="text-sm font-semibold text-neutral-100">Three ways to start</h2>
            <ol className="mt-3 space-y-2 text-xs leading-relaxed text-neutral-400">
              <li>
                <span className="text-amber-300">1.</span> Click any object in the viewport — the inspector on the right changes
                to match it.
              </li>
              <li>
                <span className="text-amber-300">2.</span> Open <span className="text-neutral-200">AI edit</span> and type a change
                (&ldquo;make the table old oak&rdquo;), or switch to <span className="text-neutral-200">New scene</span> to build a
                whole scene from a sentence.
              </li>
              <li>
                <span className="text-amber-300">3.</span> Press <span className="text-neutral-200">Space</span> to play the
                timeline, <span className="text-neutral-200">Record</span> to save a WebM preview, <span className="text-neutral-200">Still</span> for a PNG.
              </li>
            </ol>
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem("ai3d.studio-seen", "1");
                  } catch {
                    /* ignore */
                  }
                  setShowHint(false);
                }}
                className="text-[10px] text-neutral-500 hover:text-neutral-300"
              >
                Don&apos;t show again
              </button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  try {
                    localStorage.setItem("ai3d.studio-seen", "1");
                  } catch {
                    /* ignore */
                  }
                  setShowHint(false);
                }}
              >
                Start
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Toasts />
    </div>
  );
}
