"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
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

const Viewport = dynamic(() => import("@/components/studio/Viewport"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-studio-950 text-xs text-neutral-500">Loading 3D viewport…</div>
  ),
});

type RightTab = "inspect" | "ai" | "history";

export default function StudioPage() {
  const scene = useStudio((s) => s.scene);
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

  const [tab, setTab] = useState<RightTab>("inspect");
  const [saving, setSaving] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);

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
      notify("Demo workspace: connect the API to persist scenes. Nothing was written.", "warning");
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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-studio-950">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-studio-800 px-2">
        <Link href="/dashboard" className="flex items-center gap-1.5 pr-2">
          <span className="grid size-5 place-items-center rounded bg-amber-400 text-[10px] font-black text-neutral-950">3D</span>
          <span className="hidden text-xs font-semibold text-neutral-200 sm:block">{productName}</span>
        </Link>
        <div className="flex items-center gap-1.5 border-l border-studio-800 pl-2">
          <span className="max-w-40 truncate text-xs text-neutral-300">{scene.name}</span>
          <span className="font-mono text-[10px] text-neutral-600">rev {scene.revision}</span>
          {dirty ? <span className="size-1.5 rounded-full bg-amber-400" title="Unsaved changes" /> : null}
        </div>

        <div className="ml-2 flex items-center gap-1">
          <button type="button" onClick={undo} disabled={historyIndex <= 0} className="rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-studio-800 hover:text-neutral-100 disabled:opacity-30" title="Undo (Ctrl+Z)">
            ↶
          </button>
          <button type="button" onClick={redo} disabled={historyIndex >= historyLength - 1} className="rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-studio-800 hover:text-neutral-100 disabled:opacity-30" title="Redo">
            ↷
          </button>
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
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode(mode === "beginner" ? "professional" : "beginner")}
            className="rounded border border-studio-700 px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-studio-800"
            title="Beginner mode hides advanced panels"
          >
            {mode === "beginner" ? "Beginner" : "Professional"}
          </button>
          <Badge tone={selection.length ? "info" : "neutral"}>{selection.length} selected</Badge>
          <Button size="sm" variant="subtle" onClick={() => void save()} loading={saving}>Save</Button>
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
          </div>
          <div className={cn("shrink-0 border-t border-studio-800", mode === "beginner" ? "h-32" : "h-48")}>
            <Timeline />
          </div>
        </div>

        <aside className="flex w-80 shrink-0 flex-col border-l border-studio-800 bg-studio-900/60">
          <div className="border-b border-studio-800 p-1.5">
            <Tabs
              tabs={[
                { id: "inspect", label: "Inspect" },
                { id: "ai", label: "AI edit" },
                { id: "history", label: "History" },
              ]}
              active={tab}
              onChange={(id) => setTab(id as RightTab)}
            />
          </div>
          <div className="min-h-0 flex-1">
            {tab === "inspect" ? <Inspector /> : null}
            {tab === "ai" ? <AIPanel /> : null}
            {tab === "history" ? <HistoryPanel /> : null}
          </div>
        </aside>
      </div>

      <Toasts />
    </div>
  );
}
