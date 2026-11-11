"use client";

import { useMemo, useState } from "react";
import { cn } from "@ai3d/ui";
import { flattenTree, indexScene, type ObjectType } from "@ai3d/scene-core";
import { useStudio } from "@/lib/store";

const TYPE_ICON: Record<ObjectType, string> = {
  character: "☺",
  body_part: "◌",
  prop: "◆",
  furniture: "▭",
  plant: "❧",
  vehicle: "◫",
  building: "▤",
  environment: "▥",
  camera: "▣",
  light: "✷",
  audio: "♪",
  particles: "∴",
  group: "❏",
};

export function SceneTree() {
  const scene = useStudio((s) => s.scene);
  const selection = useStudio((s) => s.selection);
  const select = useStudio((s) => s.select);
  const hover = useStudio((s) => s.hover);
  const applyOps = useStudio((s) => s.applyOps);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const index = useMemo(() => indexScene(scene), [scene]);
  const flat = useMemo(() => flattenTree(index), [index]);

  const visible = useMemo(() => {
    if (!query.trim()) return flat;
    const q = query.toLowerCase();
    const matched = new Set<string>();
    for (const { object } of flat) {
      if (object.name.toLowerCase().includes(q) || object.type.includes(q) || object.tags.some((t) => t.includes(q))) {
        matched.add(object.id);
        // keep ancestors visible for context
        let parent = object.parent_id;
        while (parent) {
          matched.add(parent);
          parent = index.byId.get(parent)?.parent_id ?? null;
        }
      }
    }
    return flat.filter(({ object }) => matched.has(object.id));
  }, [flat, query, index]);

  const rows = useMemo(() => {
    if (query.trim()) return visible;
    const hidden = new Set<string>();
    for (const { object, depth } of flat) {
      let parent = object.parent_id;
      let hide = false;
      while (parent) {
        if (collapsed.has(parent)) {
          hide = true;
          break;
        }
        parent = index.byId.get(parent)?.parent_id ?? null;
      }
      if (hide) hidden.add(`${object.id}:${depth}`);
    }
    return flat.filter(({ object, depth }) => !hidden.has(`${object.id}:${depth}`));
  }, [flat, collapsed, query, index, visible]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-studio-800 p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search objects, types, tags"
          aria-label="Search scene objects"
          className="w-full rounded-md border border-studio-700 bg-studio-950 px-2 py-1 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-amber-400 focus:outline-none"
        />
      </div>
      <ul className="panel-scroll flex-1 py-1 font-mono text-[11px]">
        {rows.map(({ object, depth }) => {
          const isSelected = selection.includes(object.id);
          const hasChildren = (index.children.get(object.id)?.length ?? 0) > 0;
          return (
            <li
              key={object.id}
              onMouseEnter={() => hover(object.id)}
              onMouseLeave={() => hover(null)}
              className={cn(
                "group flex items-center gap-1 pr-1",
                isSelected ? "bg-amber-400/15 text-amber-200" : "text-neutral-300 hover:bg-studio-850",
              )}
              style={{ paddingLeft: 4 + depth * 10 }}
            >
              <button
                type="button"
                aria-label={collapsed.has(object.id) ? "Expand" : "Collapse"}
                onClick={() =>
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(object.id)) next.delete(object.id);
                    else next.add(object.id);
                    return next;
                  })
                }
                className={cn("w-3 shrink-0 text-neutral-600 hover:text-neutral-300", !hasChildren && "invisible")}
              >
                {collapsed.has(object.id) ? "▸" : "▾"}
              </button>
              <button
                type="button"
                onClick={(e) => select(object.id, e.shiftKey ? "add" : "replace")}
                className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
              >
                <span className={cn("shrink-0 text-2xs", isSelected ? "text-amber-300" : "text-neutral-500")}>{TYPE_ICON[object.type]}</span>
                <span className={cn("truncate", !object.visible && "line-through opacity-50")}>{object.name}</span>
                {object.protected ? <span title="Protected from AI edits" className="text-2xs text-sky-400">◈</span> : null}
              </button>
              <button
                type="button"
                title={object.visible ? "Hide" : "Show"}
                onClick={() => applyOps([{ op: "set_visibility", target_id: object.id, params: { visible: !object.visible } }], `${object.visible ? "Hide" : "Show"} ${object.name}`)}
                className="px-0.5 text-2xs text-neutral-600 opacity-0 hover:text-neutral-200 group-hover:opacity-100"
              >
                {object.visible ? "◉" : "○"}
              </button>
              <button
                type="button"
                title={object.locked ? "Unlock" : "Lock"}
                onClick={() => applyOps([{ op: "set_locked", target_id: object.id, params: { locked: !object.locked } }], `${object.locked ? "Unlock" : "Lock"} ${object.name}`)}
                className={cn("px-0.5 text-2xs hover:text-neutral-200", object.locked ? "text-amber-400" : "text-neutral-600 opacity-0 group-hover:opacity-100")}
              >
                {object.locked ? "🔒" : "🔓"}
              </button>
            </li>
          );
        })}
        {rows.length === 0 ? <li className="px-3 py-6 text-center text-2xs text-neutral-500">No objects match.</li> : null}
      </ul>
      <div className="border-t border-studio-800 px-2 py-1.5 text-2xs text-neutral-500">
        {selection.length ? `${selection.length} selected` : `${scene.objects.length} objects`}
      </div>
    </div>
  );
}
