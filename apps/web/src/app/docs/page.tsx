import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";

const CONCEPTS = [
  {
    term: "Scene document",
    body: "The application-owned JSON document (schema ai3d.scene/1.1) holding objects, materials, animations and shots. It is versioned, validated and migrated; Blender is rebuilt from it.",
  },
  {
    term: "Edit plan",
    body: "A structured list of operations plus a preservation policy. Plans come from the deterministic planner or an LLM adapter, then are validated against the live scene. Nothing applies until validation passes.",
  },
  {
    term: "Object id",
    body: "Stable identifier used by selection, edits, animations, the audit log and Blender object names. Renaming never changes the id.",
  },
  {
    term: "Shot",
    body: "A frame range bound to a camera, with subjects and a transition. The Director generates shots; the timeline edits them.",
  },
];

export default function DocsPage() {
  return (
    <MarketingShell
      title="Documentation"
      lead="The repository ships full documentation under /docs. This page is the orientation map."
    >
      <section>
        <h2 className="text-base font-semibold text-neutral-100">Start here</h2>
        <ul className="mt-3 space-y-2 text-xs text-neutral-400">
          {[
            ["docs/setup/local-development.md", "run the web app, API, Postgres and Redis locally"],
            ["docs/architecture/overview.md", "services, data flow, why the scene document is authoritative"],
            ["docs/architecture/scene-graph.md", "document model, ids, migrations, validation rules"],
            ["docs/architecture/ai-editing.md", "plan → validate → preview → apply, and the preservation policy"],
            ["docs/api/rest.md", "endpoints, auth, error envelope, rate limits"],
            ["docs/deployment/vercel-supabase.md", "the temporary public deployment runbook"],
            ["docs/development/model-registry.md", "licence status for every candidate model"],
          ].map(([path, note]) => (
            <li key={path}>
              <code className="rounded bg-studio-850 px-1.5 py-0.5 font-mono text-neutral-300">{path}</code>
              <span className="ml-2">{note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-neutral-100">Core concepts</h2>
        <dl className="mt-3 space-y-4 text-xs leading-relaxed text-neutral-400">
          {CONCEPTS.map((c) => (
            <div key={c.term}>
              <dt className="font-medium text-neutral-200">{c.term}</dt>
              <dd>{c.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="text-base font-semibold text-neutral-100">Keyboard</h2>
        <ul className="mt-3 grid gap-1 text-xs text-neutral-400 sm:grid-cols-2">
          <li><kbd className="rounded bg-studio-850 px-1.5 py-0.5 font-mono">1</kbd> translate gizmo</li>
          <li><kbd className="rounded bg-studio-850 px-1.5 py-0.5 font-mono">2</kbd> rotate gizmo</li>
          <li><kbd className="rounded bg-studio-850 px-1.5 py-0.5 font-mono">3</kbd> scale gizmo</li>
          <li><kbd className="rounded bg-studio-850 px-1.5 py-0.5 font-mono">F</kbd> frame selection</li>
          <li><kbd className="rounded bg-studio-850 px-1.5 py-0.5 font-mono">Space</kbd> play / pause</li>
          <li><kbd className="rounded bg-studio-850 px-1.5 py-0.5 font-mono">Ctrl/⌘ Z</kbd> undo</li>
        </ul>
      </section>

      <p className="text-xs text-neutral-500">
        <Link href="/help" className="text-amber-300 hover:text-amber-200">Help centre →</Link>
      </p>
    </MarketingShell>
  );
}
