"use client";

import Link from "next/link";
import { Badge, Button } from "@ai3d/ui";
import { buildDemoScene } from "@ai3d/scene-core";
import { AppShell } from "@/components/AppShell";

const scene = buildDemoScene();

const LIBRARY_CLIPS = [
  { id: "walk.cycle.01", name: "Walk cycle", frames: 48, kind: "transform", note: "24 fps loop, in-place" },
  { id: "run.cycle.01", name: "Run cycle", frames: 36, kind: "transform", note: "24 fps loop, in-place" },
  { id: "reach.pickup", name: "Reach and pick up", frames: 36, kind: "pose", note: "Right hand target, needs IK" },
  { id: "sit.down", name: "Sit down", frames: 42, kind: "pose", note: "Chair-relative" },
  { id: "wave.greet", name: "Wave", frames: 36, kind: "pose", note: "Friendly, 1 cycle" },
  { id: "turn.look", name: "Turn and look", frames: 24, kind: "pose", note: "Head + torso" },
];

export default function AnimationPage() {
  return (
    <AppShell
      title="Animation Studio"
      subtitle="Editable clips, keyframes and object interactions"
      actions={<Link href="/studio" className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-amber-300">Open timeline</Link>}
    >
      <div className="space-y-4">
        <section className="rounded-xl border border-studio-800 bg-studio-900/60">
          <header className="flex items-center justify-between border-b border-studio-800 px-3 py-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Clips in this scene</h2>
            <span className="text-2xs text-neutral-500">{scene.animations.length} clips · {scene.settings.duration_frames} frames</span>
          </header>
          <ul className="divide-y divide-studio-800">
            {scene.animations.map((clip) => {
              const target = scene.objects.find((o) => o.id === clip.target_id);
              const keyframes = clip.tracks.reduce((n, t) => n + t.keyframes.length, 0);
              return (
                <li key={clip.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-2xs">
                  <span className="min-w-40 text-xs text-neutral-100">{clip.name}</span>
                  <span className="text-neutral-500">{target?.name}</span>
                  <Badge tone={clip.kind === "transform" ? "info" : "neutral"}>{clip.kind}</Badge>
                  <span className="font-mono text-neutral-500">{clip.start_frame}–{clip.end_frame}</span>
                  <span className="text-neutral-600">{keyframes} keys · {clip.tracks.length} tracks</span>
                  <span className="ml-auto text-neutral-600">{clip.source.kind}{clip.source.model_id ? ` · ${clip.source.model_id}` : ""}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border border-studio-800 bg-studio-900/60">
          <header className="flex items-center justify-between border-b border-studio-800 px-3 py-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Clip library</h2>
            <span className="text-2xs text-neutral-500">procedural placeholders until a motion model is licensed</span>
          </header>
          <ul className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {LIBRARY_CLIPS.map((clip) => (
              <li key={clip.id} className="rounded-lg border border-studio-800 bg-studio-950/60 p-2">
                <p className="text-xs text-neutral-100">{clip.name}</p>
                <p className="text-[10px] text-neutral-500">{clip.note}</p>
                <p className="mt-1 font-mono text-[10px] text-neutral-600">{clip.id} · {clip.frames}f · {clip.kind}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Supported interactions</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["pick up", "put down", "open", "close", "push", "pull", "sit", "walk", "run", "turn", "look", "gesture"].map((i) => (
              <span key={i} className="rounded-full border border-studio-700 px-2 py-0.5 text-2xs text-neutral-300">{i}</span>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-neutral-500">
            Object interactions are authored as IK targets plus parent switching (e.g. the apple re-parents to the hand socket at
            the pickup frame). AI-generated clips are labelled with their producer and remain fully editable keyframes.
          </p>
          <Button size="sm" variant="subtle" className="mt-3" disabled>
            Generate clip from prompt (requires motion model)
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
