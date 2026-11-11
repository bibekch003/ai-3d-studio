import Link from "next/link";
import { buildDemoScene, flattenTree, indexScene, sceneStats } from "@ai3d/scene-core";
import { productName, productTagline } from "@/lib/product";

export default function LandingPage() {
  const scene = buildDemoScene();
  const tree = flattenTree(indexScene(scene));
  const stats = sceneStats(scene);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-studio-800 bg-studio-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-amber-400 text-[13px] font-black text-neutral-950">3D</span>
            <span className="text-sm font-semibold">{productName}</span>
          </Link>
          <nav className="ml-auto flex items-center gap-5 text-xs text-neutral-400">
            <Link href="/features" className="hidden hover:text-neutral-100 sm:block">Features</Link>
            <Link href="/docs" className="hidden hover:text-neutral-100 sm:block">Docs</Link>
            <Link href="/login" className="hover:text-neutral-100">Sign in</Link>
            <Link href="/studio" className="rounded-md bg-amber-400 px-3 py-1.5 font-medium text-neutral-950 hover:bg-amber-300">
              Open studio
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-studio-800">
        <div className="grid-bg absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 py-20">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-2xs font-medium text-amber-300">
            Editable 3D scenes, not just generated video
          </p>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-neutral-50 sm:text-5xl">
            Describe the shot. Direct it like a film. Then click anything to change it.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-400">
            {productName} turns a written scene into a structured, fully editable 3D scene graph — characters with nested rigs,
            props, sets, lights, cameras and an animation timeline. Every object has a stable id, so any AI edit is scoped,
            previewable and reversible. {productTagline}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/studio" className="rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-amber-300">
              Open the studio
            </Link>
            <Link href="/ai-director" className="rounded-lg border border-studio-700 px-5 py-2.5 text-sm font-medium text-neutral-200 hover:bg-studio-850">
              Try the AI Director
            </Link>
            <span className="text-2xs text-neutral-500">Runs in the browser · no account needed for the demo scene</span>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h2 className="text-lg font-semibold text-neutral-100">The scene graph is the product</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-400">
            The prompt below produced {stats.objects} addressable objects, {stats.animations} animation clips and {stats.shots} shots.
            This is the actual tree the editor loads — not a mock-up.
          </p>
          <div className="mt-5 rounded-xl border border-studio-800 bg-studio-900/60">
            <div className="flex items-center justify-between border-b border-studio-800 px-3 py-2 text-2xs uppercase tracking-wider text-neutral-500">
              <span>Scene hierarchy</span>
              <span className="font-mono normal-case">{scene.settings.fps} fps · {scene.settings.duration_frames} frames</span>
            </div>
            <ul className="max-h-80 overflow-y-auto p-2 font-mono text-[11px] leading-6">
              {tree.map(({ object, depth }) => (
                <li key={object.id} style={{ paddingLeft: depth * 12 }} className="flex items-center gap-2">
                  <span className={object.type === "character" ? "text-amber-300" : object.type === "camera" || object.type === "light" ? "text-sky-300" : "text-neutral-300"}>
                    {object.name}
                  </span>
                  <span className="text-neutral-600">{object.type}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
            <p className="text-2xs uppercase tracking-wider text-neutral-500">Prompt</p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-200">
              &ldquo;A young man enters a room, walks towards a wooden table, picks up a red apple and takes a bite.&rdquo;
            </p>
          </div>
          <div className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
            <p className="text-2xs uppercase tracking-wider text-neutral-500">Shot list</p>
            <ol className="mt-2 space-y-2 text-xs text-neutral-300">
              {scene.shots.map((shot) => (
                <li key={shot.id} className="flex gap-2">
                  <span className="font-mono text-amber-300">{String(shot.index + 1).padStart(2, "0")}</span>
                  <span>
                    <span className="font-medium text-neutral-200">{shot.name}</span>
                    <span className="text-neutral-500"> · frames {shot.start_frame}–{shot.end_frame}</span>
                    <span className="block text-neutral-500">{shot.description}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-y border-studio-800 bg-studio-900/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-3">
          {[
            {
              title: "Click-to-edit anything",
              body: "Raycast selection on real object ids, hierarchy-aware multi-select, and natural-language edits that are validated against the scene before they apply.",
            },
            {
              title: "Non-destructive by default",
              body: "Every AI edit is a plan you can inspect: targets, operations, preserved properties. Snapshots, undo/redo and scene variations are built in.",
            },
            {
              title: "Production engine attached",
              body: "The same scene document rebuilds in Blender for EEVEE previews and Cycles finals, and exports an editable .blend project.",
            },
          ].map((card) => (
            <div key={card.title} className="rounded-xl border border-studio-800 bg-studio-900/60 p-5">
              <h3 className="text-sm font-semibold text-neutral-100">{card.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-neutral-400">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-lg font-semibold text-neutral-100">How a shot is made</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["01", "Describe", "One sentence, or a full beat sheet. The Director returns cast, props, environment and shots."],
            ["02", "Review the plan", "Structured operations with affected objects listed. Approve, edit or reject each step."],
            ["03", "Edit by clicking", "Select any part — a hand, a hairstyle, a table material — and describe the change."],
            ["04", "Render", "Preview in EEVEE, finish in Cycles, or export the .blend and take it into your own pipeline."],
          ].map(([n, title, body]) => (
            <li key={n} className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
              <span className="font-mono text-2xs text-amber-400">{n}</span>
              <h3 className="mt-1 text-sm font-medium text-neutral-100">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-neutral-400">{body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 rounded-xl border border-studio-800 bg-studio-900/60 p-5">
          <h3 className="text-sm font-semibold text-neutral-100">Honest about what is real</h3>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            The browser editor, scene graph, edit planner, validation, history and Blender scene builder in this repository are
            working code with tests. Model-backed generation (text-to-3D, motion, lip-sync) ships as replaceable adapters: when
            a provider is not configured the feature is visibly disabled rather than faked. See the model registry in the docs
            for licence status before enabling anything for commercial work.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-2xs">
            <Link href="/docs" className="text-amber-300 hover:text-amber-200">Read the architecture →</Link>
            <Link href="/features" className="text-amber-300 hover:text-amber-200">Feature breakdown →</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-studio-800 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 text-2xs text-neutral-500">
          <span>© {new Date().getFullYear()} {productName}</span>
          <Link href="/privacy" className="hover:text-neutral-300">Privacy</Link>
          <Link href="/terms" className="hover:text-neutral-300">Terms</Link>
          <Link href="/help" className="hover:text-neutral-300">Help centre</Link>
          <Link href="/docs" className="hover:text-neutral-300">Documentation</Link>
        </div>
      </footer>
    </div>
  );
}
