import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";

const GROUPS = [
  {
    title: "Selection and editing",
    items: [
      "Raycast selection on stable object ids, with hover highlight and outline",
      "Hierarchy-aware multi-select, subtree select, category select, lock and hide",
      "Context-aware inspector that changes per object type",
      "Natural-language edits compiled to structured operations, validated before apply",
      "Explicit preservation policy: keep face, hair, identity, materials, camera, lighting",
    ],
  },
  {
    title: "Scene model",
    items: [
      "Versioned scene document (schema 1.1) with forward migrations",
      "Nested character hierarchy: head, face, eyes, hair, body, arms, legs, clothing",
      "PBR material library with procedural recipes and texture slots",
      "Cameras, lights, audio and particle objects as first-class scene nodes",
      "Shot list with frame ranges, transitions and per-shot subjects",
    ],
  },
  {
    title: "Non-destructive workflow",
    items: [
      "Snapshot history with undo, redo and jump-to-version",
      "Branching scene variations from any point in history",
      "Per-object version counters so diffs are exact",
      "Plan-level audit records: prompt, producer, operations, touched objects",
      "Protected objects and locked properties that AI edits cannot cross",
    ],
  },
  {
    title: "Production",
    items: [
      "Blender scene builder: primitives, materials, hierarchy, cameras, lights, keyframes",
      "EEVEE preview renders and Cycles finals, with configurable samples and denoise",
      "Editable .blend export plus MP4 / PNG sequence / EXR sequence outputs",
      "FastAPI job service with queue-backed render and generation workers",
      "Row Level Security in Postgres so projects are isolated per account",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <MarketingShell
      title="Everything is an object. Everything is editable."
      lead="A feature tour of the parts that are implemented in this repository, and the parts that are deliberately adapters."
    >
      <div className="space-y-10">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="text-base font-semibold text-neutral-100">{group.title}</h2>
            <ul className="mt-3 space-y-2">
              {group.items.map((item) => (
                <li key={item} className="flex gap-2 text-xs leading-relaxed text-neutral-400">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-5">
          <h2 className="text-base font-semibold text-amber-200">What is not claimed</h2>
          <p className="mt-2 text-xs leading-relaxed text-neutral-300">
            No model weights are bundled. Text-to-3D, motion generation, lip-sync and video generation are adapter interfaces;
            they are disabled until you configure a provider and record its licence. The built-in planner is a deterministic rule
            engine and is labelled as such everywhere it appears. Character rigs come from your asset library, not from a
            generative model in this build.
          </p>
        </section>
        <p className="text-xs text-neutral-500">
          <Link href="/studio" className="text-amber-300 hover:text-amber-200">Open the studio →</Link>
        </p>
      </div>
    </MarketingShell>
  );
}
