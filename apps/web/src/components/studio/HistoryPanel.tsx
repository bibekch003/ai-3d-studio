"use client";

import { useState } from "react";
import { Badge, Button } from "@ai3d/ui";
import { useStudio } from "@/lib/store";

export function HistoryPanel() {
  const scene = useStudio((s) => s.scene);
  const historyVersion = useStudio((s) => s.historyVersion);
  const historyIndex = useStudio((s) => s.historyIndex);
  const jumpTo = useStudio((s) => s.jumpTo);
  const branch = useStudio((s) => s.branch);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const [branchName, setBranchName] = useState("Variation");
  const entries = useStudio.getState().historyList();

  // historyVersion forces a re-read of the mutable history object
  void historyVersion;
  void scene.revision;

  return (
    <div className="panel-scroll h-full space-y-2 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">History</h2>
        <div className="flex gap-1">
          <Button size="sm" variant="subtle" onClick={() => undo()}>Undo</Button>
          <Button size="sm" variant="subtle" onClick={() => redo()}>Redo</Button>
        </div>
      </div>
      <p className="text-[10px] leading-relaxed text-neutral-500">
        Every applied plan and manual edit is a snapshot. Click any entry to inspect that version; branch to keep a variation.
      </p>
      <ol className="space-y-1">
        {entries.map((entry, i) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => jumpTo(entry.id)}
              className={
                i === historyIndex
                  ? "w-full rounded border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-left"
                  : "w-full rounded border border-transparent px-2 py-1 text-left hover:border-studio-700 hover:bg-studio-850"
              }
            >
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[11px] text-neutral-200">{entry.label}</span>
                {entry.kind === "ai_plan" ? <Badge tone="info">AI</Badge> : null}
                {entry.kind === "branch" ? <Badge tone="warning">branch</Badge> : null}
              </div>
              <p className="truncate text-[10px] text-neutral-500">
                rev {entry.revision} · {new Date(entry.timestamp).toLocaleTimeString("en-IN")}
                {entry.prompt ? ` · "${entry.prompt}"` : ""}
              </p>
            </button>
          </li>
        ))}
      </ol>
      <div className="space-y-1 border-t border-studio-800 pt-2">
        <label className="block text-[10px] text-neutral-500" htmlFor="branch-name">New variation from this point</label>
        <div className="flex gap-1">
          <input
            id="branch-name"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            className="min-w-0 flex-1 rounded border border-studio-700 bg-studio-950 px-2 py-1 text-[11px] text-neutral-200 focus:border-amber-400 focus:outline-none"
          />
          <Button size="sm" onClick={() => branch(branchName || "Variation")}>Branch</Button>
        </div>
      </div>
    </div>
  );
}
