"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Field, TextArea, TextInput } from "@ai3d/ui";
import { planScene, type ScenePlan } from "@ai3d/scene-core";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";
import { isApiConfigured } from "@/lib/product";

const EXAMPLES = [
  "A boy enters a room, walks towards a wooden table, picks up a red apple and takes a bite.",
  "A detective opens a door in a rainy street at night, looks at a letter and turns away.",
  "A robot sits in a futuristic laboratory at dawn, picks up a cup and reads a book.",
];

export default function DirectorPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState(EXAMPLES[0]!);
  const [plan, setPlan] = useState<ScenePlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<"local" | "server">("local");
  const [shots, setShots] = useState<ScenePlan["shots"]>([]);

  async function generate() {
    setBusy(true);
    let next: ScenePlan | null = null;
    if (isApiConfigured) {
      try {
        const res = await api.directorPlan(prompt);
        next = res as unknown as ScenePlan;
        setSource("server");
      } catch {
        /* fall back to the local planner and label it */
      }
    }
    if (!next) {
      next = planScene(prompt);
      setSource("local");
    }
    setPlan(next);
    setShots(next.shots);
    setBusy(false);
  }

  function sendToStudio() {
    if (!plan) return;
    // Hand the structured operations to the studio; nothing is executed here.
    sessionStorage.setItem("ai3d.pendingPlan", JSON.stringify({ prompt: plan.prompt, operations: plan.operations }));
    router.push("/studio");
  }

  return (
    <AppShell
      title="AI Director"
      subtitle="Description → cast, props, environment, beats and shots"
      actions={<Badge tone={source === "server" ? "success" : "neutral"}>{source === "server" ? "server planner" : "local rule engine"}</Badge>}
    >
      <div className="space-y-4">
        <section className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
          <Field label="Scene description" hint="one sentence to a short paragraph">
            <TextArea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-20 text-sm" />
          </Field>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => void generate()} loading={busy} disabled={prompt.trim().length < 8}>
              Build scene plan
            </Button>
            {plan ? <Button variant="secondary" onClick={sendToStudio}>Send to studio</Button> : null}
            <div className="flex flex-wrap gap-1">
              {EXAMPLES.slice(1).map((ex) => (
                <button key={ex} type="button" onClick={() => setPrompt(ex)} className="rounded-full border border-studio-700 px-2 py-0.5 text-[10px] text-neutral-400 hover:text-neutral-100">
                  example
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
            The Director returns a structured plan — never generated code. Every shot is editable before it reaches the scene,
            and the resulting scene is a normal, fully editable document.
          </p>
        </section>

        {plan ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
            <div className="space-y-3">
              <section className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Logline</h2>
                <p className="mt-1 text-sm leading-relaxed text-neutral-200">{plan.logline}</p>
                <dl className="mt-3 grid grid-cols-2 gap-1 text-2xs text-neutral-400">
                  <div><dt className="inline text-neutral-500">Environment: </dt><dd className="inline">{plan.environment.preset_id}</dd></div>
                  <div><dt className="inline text-neutral-500">Time: </dt><dd className="inline">{plan.environment.time_of_day}</dd></div>
                  <div><dt className="inline text-neutral-500">Style: </dt><dd className="inline">{plan.style}</dd></div>
                  <div><dt className="inline text-neutral-500">Length: </dt><dd className="inline">{plan.total_frames} frames @ {plan.fps} fps</dd></div>
                </dl>
              </section>

              <section className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Cast &amp; props</h2>
                <ul className="mt-2 space-y-2">
                  {plan.characters.map((c) => (
                    <li key={c.name} className="text-2xs">
                      <p className="text-neutral-200">{c.name.replace(/_/g, " ")} <Badge tone="info">{c.role}</Badge></p>
                      <p className="text-neutral-500">{c.description}</p>
                    </li>
                  ))}
                  {plan.props.map((p) => (
                    <li key={p.name} className="text-2xs">
                      <p className="text-neutral-200">{p.name} <span className="text-neutral-500">· {p.interaction}</span></p>
                      <p className="text-neutral-500">{p.description}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
                  Characters are cast from the character library, not generated here: a plan names the role and the studio
                  resolves it to a rigged profile.
                </p>
              </section>

              <section className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Beat sheet</h2>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-2xs text-neutral-300">
                  {plan.beats.map((beat, i) => <li key={`${beat}-${i}`}>{beat}</li>)}
                </ol>
                {plan.warnings.length ? (
                  <ul className="mt-3 space-y-1">
                    {plan.warnings.map((w, i) => <li key={i} className="text-[10px] text-amber-300">! {w}</li>)}
                  </ul>
                ) : null}
              </section>
            </div>

            <section className="rounded-xl border border-studio-800 bg-studio-900/60">
              <header className="flex items-center justify-between border-b border-studio-800 px-3 py-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Shot list — editable</h2>
                <span className="text-2xs text-neutral-500">{shots.length} shots</span>
              </header>
              <ul className="divide-y divide-studio-800">
                {shots.map((shot, i) => (
                  <li key={`${shot.name}-${i}`} className="space-y-1 p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-2xs text-amber-300">{String(i + 1).padStart(2, "0")}</span>
                      <TextInput
                        value={shot.name}
                        aria-label={`Shot ${i + 1} name`}
                        onChange={(e) => setShots(shots.map((s, idx) => (idx === i ? { ...s, name: e.target.value } : s)))}
                        className="h-7 text-xs"
                      />
                      <div className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-neutral-500">
                        <input
                          type="number"
                          value={shot.start_frame}
                          aria-label={`Shot ${i + 1} start frame`}
                          onChange={(e) => setShots(shots.map((s, idx) => (idx === i ? { ...s, start_frame: Number(e.target.value) } : s)))}
                          className="w-14 rounded border border-studio-700 bg-studio-950 px-1 py-0.5 text-right"
                        />
                        <span>–</span>
                        <input
                          type="number"
                          value={shot.end_frame}
                          aria-label={`Shot ${i + 1} end frame`}
                          onChange={(e) => setShots(shots.map((s, idx) => (idx === i ? { ...s, end_frame: Number(e.target.value) } : s)))}
                          className="w-14 rounded border border-studio-700 bg-studio-950 px-1 py-0.5 text-right"
                        />
                      </div>
                    </div>
                    <TextArea
                      value={shot.description}
                      aria-label={`Shot ${i + 1} description`}
                      onChange={(e) => setShots(shots.map((s, idx) => (idx === i ? { ...s, description: e.target.value } : s)))}
                      className="min-h-12 text-2xs"
                    />
                    <p className="text-[10px] text-neutral-500">
                      {shot.camera_shot_type.replace(/_/g, " ")} · {shot.camera_movement} · {shot.lighting_note} · {shot.transition_in} in
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-studio-800 p-10 text-center text-xs text-neutral-500">
            Describe a scene to see the cast, props, beats and shot list.
          </div>
        )}
      </div>
    </AppShell>
  );
}
