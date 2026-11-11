"use client";

import { useState } from "react";
import { Badge, Button, TextArea } from "@ai3d/ui";
import { describeOp, planEdit, type EditPlan } from "@ai3d/scene-core";
import { useStudio } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { isApiConfigured } from "@/lib/product";

const EXAMPLES = [
  "Make the table look like old oak wood.",
  "Change his hairstyle but preserve his face.",
  "Change the lighting to a sunset atmosphere.",
  "Replace the plant with a palm tree.",
  "Make the room look like a futuristic laboratory.",
  "Change the entire scene to a cinematic style.",
];

const PRESERVE_OPTIONS = ["face", "hair", "identity", "materials", "camera", "lighting"] as const;

export function AIPanel() {
  const scene = useStudio((s) => s.scene);
  const selection = useStudio((s) => s.selection);
  const plan = useStudio((s) => s.pendingPlan);
  const planSource = useStudio((s) => s.planSource);
  const planErrors = useStudio((s) => s.planErrors);
  const planWarnings = useStudio((s) => s.planWarnings);
  const setPlan = useStudio((s) => s.setPlan);
  const applyPendingPlan = useStudio((s) => s.applyPendingPlan);
  const discardPlan = useStudio((s) => s.discardPlan);
  const selectByQuery = useStudio((s) => s.selectByQuery);
  const selectByType = useStudio((s) => s.selectByType);

  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [scopeToSelection, setScopeToSelection] = useState(false);
  const [preserve, setPreserve] = useState<string[]>([]);
  const [selectQuery, setSelectQuery] = useState("");
  const [candidates, setCandidates] = useState<{ id: string; name: string; score: number }[]>([]);

  async function buildPlan() {
    const text = prompt.trim();
    if (text.length < 3) return;
    setBusy(true);
    let next: EditPlan | null = null;
    let source: "local" | "server" = "local";

    if (isApiConfigured) {
      try {
        const res = await api.planEdit(scene.id, text, preserve);
        next = res.plan;
        source = "server";
      } catch (error) {
        if (error instanceof ApiError && error.status === 422) {
          useStudio.getState().notify(error.message, "danger");
          setBusy(false);
          return;
        }
        // Fall through to the local planner; the panel labels the producer.
      }
    }

    if (!next) {
      next = planEdit(text, scene, scopeToSelection && selection.length ? { scope: selection } : {});
      if (preserve.length) {
        next = { ...next, preserve: { ...next.preserve, properties: [...new Set([...next.preserve.properties, ...preserve])] } };
      }
    }

    setPlan(next, source);
    setBusy(false);
  }

  return (
    <div className="panel-scroll h-full space-y-3 p-3">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">AI edit</h2>
          <Badge tone={planSource === "server" ? "success" : "neutral"}>{planSource === "server" ? "server planner" : "local rule engine"}</Badge>
        </div>
        <TextArea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void buildPlan();
          }}
          placeholder="Describe the change… e.g. 'Change his hairstyle but preserve his face.'"
          aria-label="Edit instruction"
          className="min-h-24 text-xs"
        />
        <div className="flex flex-wrap gap-1">
          {EXAMPLES.slice(0, 4).map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setPrompt(ex)}
              className="rounded-full border border-studio-700 px-2 py-0.5 text-[10px] text-neutral-400 hover:border-amber-400/40 hover:text-amber-200"
            >
              {ex.replace(/\.$/, "")}
            </button>
          ))}
        </div>

        <details className="rounded-lg border border-studio-800 bg-studio-900/40 p-2">
          <summary className="cursor-pointer text-[11px] text-neutral-400">Preserve &amp; scope</summary>
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap gap-1">
              {PRESERVE_OPTIONS.map((prop) => {
                const on = preserve.includes(prop);
                return (
                  <button
                    key={prop}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPreserve((prev) => (on ? prev.filter((p) => p !== prop) : [...prev, prop]))}
                    className={
                      on
                        ? "rounded border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-200"
                        : "rounded border border-studio-700 px-2 py-0.5 text-[10px] text-neutral-400 hover:text-neutral-200"
                    }
                  >
                    keep {prop}
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 text-[10px] text-neutral-400">
              <input type="checkbox" checked={scopeToSelection} onChange={(e) => setScopeToSelection(e.target.checked)} />
              Limit targets to the current selection ({selection.length})
            </label>
          </div>
        </details>

        <Button variant="primary" className="w-full" onClick={() => void buildPlan()} loading={busy} disabled={prompt.trim().length < 3}>
          Plan edit
        </Button>
        <p className="text-[10px] leading-relaxed text-neutral-500">
          {isApiConfigured
            ? "Plans come from the API when reachable; otherwise the local deterministic planner runs in the browser."
            : "No API configured: the deterministic rule planner runs locally. It is not an LLM and is labelled as such."}
        </p>
      </section>

      {plan ? (
        <section className="space-y-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.04] p-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium text-amber-200">{plan.summary}</p>
              <p className="text-[10px] text-neutral-500">
                {plan.operations.length} operation{plan.operations.length === 1 ? "" : "s"} · confidence {(plan.confidence * 100).toFixed(0)}% ·{" "}
                {plan.producer.kind === "deterministic" ? "rule engine" : plan.producer.kind}
              </p>
            </div>
            <Badge tone={plan.confidence >= 0.7 ? "success" : plan.confidence >= 0.5 ? "warning" : "danger"}>
              {plan.confidence >= 0.7 ? "high" : plan.confidence >= 0.5 ? "review" : "low"}
            </Badge>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Targets</p>
            <ul className="mt-1 space-y-0.5">
              {plan.targets.length ? (
                plan.targets.map((t) => (
                  <li key={t.object_id} className="flex justify-between gap-2 text-[10px] text-neutral-300">
                    <span className="truncate">{t.name}</span>
                    <span className="shrink-0 text-neutral-500">{t.type}</span>
                  </li>
                ))
              ) : (
                <li className="text-[10px] text-neutral-500">Scene-level change</li>
              )}
            </ul>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Operations</p>
            <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-neutral-400">
              {plan.operations.map((op, i) => (
                <li key={`${op.op}-${i}`} className="truncate">
                  <span className="text-amber-300">{op.op}</span> · {describeOp(op, plan.targets.find((t) => t.object_id === op.target_id)?.name ?? "scene")}
                </li>
              ))}
            </ul>
          </div>

          {plan.preserve.properties.length ? (
            <p className="text-[10px] text-sky-300">Preserving: {plan.preserve.properties.join(", ")}</p>
          ) : null}

          {planErrors.length ? (
            <ul className="space-y-1 rounded border border-red-500/30 bg-red-950/40 p-1.5">
              {planErrors.map((err, i) => (
                <li key={i} className="text-[10px] leading-relaxed text-red-300">✕ {err.message}</li>
              ))}
            </ul>
          ) : null}

          {(planWarnings.length || planWarnings.length === 0) && plan.warnings.length ? (
            <ul className="space-y-1">
              {[...new Set([...planWarnings.map((w) => w.message), ...plan.warnings])].map((warning, i) => (
                <li key={i} className="text-[10px] leading-relaxed text-amber-300/90">! {warning}</li>
              ))}
            </ul>
          ) : null}

          {plan.requires_confirmation ? (
            <p className="rounded border border-amber-500/30 bg-amber-500/10 p-1.5 text-[10px] text-amber-200">
              This plan asks for confirmation before it changes anything.
            </p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <Button variant="primary" size="sm" className="flex-1" disabled={planErrors.length > 0 || plan.operations.length === 0} onClick={() => applyPendingPlan()}>
              Apply
            </Button>
            <Button variant="ghost" size="sm" onClick={() => discardPlan()}>
              Discard
            </Button>
          </div>
        </section>
      ) : null}

      <section className="space-y-2 border-t border-studio-800 pt-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">AI selection</h2>
        <div className="flex gap-1">
          <input
            value={selectQuery}
            onChange={(e) => setSelectQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && selectQuery.trim()) setCandidates(selectByQuery(selectQuery));
            }}
            placeholder="the apple, his hair, all plants"
            aria-label="Select by description"
            className="min-w-0 flex-1 rounded border border-studio-700 bg-studio-950 px-2 py-1 text-[11px] text-neutral-200 placeholder:text-neutral-600 focus:border-amber-400 focus:outline-none"
          />
          <Button size="sm" onClick={() => setCandidates(selectByQuery(selectQuery))} disabled={!selectQuery.trim()}>
            Find
          </Button>
        </div>
        {candidates.length ? (
          <ul className="space-y-0.5">
            {candidates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => useStudio.getState().select(c.id)}
                  className="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-[10px] text-neutral-400 hover:bg-studio-850 hover:text-neutral-100"
                >
                  <span className="truncate">{c.name}</span>
                  <span className="font-mono text-neutral-600">{c.score.toFixed(2)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-1">
          {[
            ["Characters", () => selectByType("character")],
            ["Lights", () => selectByType("light")],
            ["Props", () => selectByType("prop")],
            ["Cameras", () => selectByType("camera")],
            ["Everything", () => selectByType(["character", "prop", "furniture", "plant", "light", "camera", "environment"])],
          ].map(([label, fn]) => (
            <button
              key={String(label)}
              type="button"
              onClick={fn as () => void}
              className="rounded border border-studio-700 px-2 py-0.5 text-[10px] text-neutral-400 hover:text-neutral-100"
            >
              {String(label)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
