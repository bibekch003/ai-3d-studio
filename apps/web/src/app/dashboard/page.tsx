import Link from "next/link";
import { Badge } from "@ai3d/ui";
import { AppShell } from "@/components/AppShell";
import { demoJobs, demoModels, demoProjects, demoUsage } from "@/lib/demo-data";
import { isApiConfigured, productName } from "@/lib/product";

export const metadata = { title: "Home" };

export default function DashboardPage() {
  const usage = demoUsage;
  const pct = (used: number, limit: number) => Math.min(100, Math.round((used / limit) * 100));

  return (
    <AppShell
      title="Home"
      subtitle={`${productName} · demo workspace`}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/ai-director" className="rounded-md border border-studio-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-studio-800">
            Describe a scene
          </Link>
          <Link href="/studio" className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-amber-300">
            Open studio
          </Link>
        </div>
      }
    >
      <div className="space-y-5">
        {!isApiConfigured ? (
          <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-xs leading-relaxed text-amber-200">
            <span className="font-semibold">Demo data.</span> No API is configured, so this dashboard shows sample content and the
            studio runs on the bundled scene. Set <span className="font-mono">NEXT_PUBLIC_API_BASE_URL</span> to read real projects.
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Projects", value: String(demoProjects.length), note: "1 with unsaved changes" },
            { label: "AI edits this month", value: String(usage.ai_edits), note: `of ${usage.limits.ai_edits} on ${usage.plan}` },
            { label: "Render minutes", value: usage.render_minutes.toFixed(1), note: `of ${usage.limits.render_minutes}` },
            { label: "Storage", value: `${usage.storage_mb} MB`, note: `of ${usage.limits.storage_mb} MB` },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
              <p className="text-2xs uppercase tracking-wider text-neutral-500">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold text-neutral-50">{stat.value}</p>
              <p className="mt-0.5 text-2xs text-neutral-500">{stat.note}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-xl border border-studio-800 bg-studio-900/60">
            <header className="flex items-center justify-between border-b border-studio-800 px-4 py-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Recent projects</h2>
              <Link href="/projects" className="text-2xs text-amber-300 hover:text-amber-200">All projects →</Link>
            </header>
            <ul className="divide-y divide-studio-800">
              {demoProjects.map((project) => (
                <li key={project.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="grid size-9 place-items-center rounded-md bg-studio-800 text-2xs text-neutral-400">3D</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-100">{project.name}</p>
                    <p className="truncate text-2xs text-neutral-500">{project.description}</p>
                  </div>
                  <div className="hidden text-right text-2xs text-neutral-500 sm:block">
                    <p>{project.fps} fps · {project.default_resolution}</p>
                    <p>updated {new Date(project.updated_at).toLocaleDateString("en-IN")}</p>
                  </div>
                  <Link href="/studio" className="rounded-md border border-studio-700 px-2 py-1 text-2xs text-neutral-300 hover:bg-studio-800">
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <div className="space-y-4">
            <section className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Usage</h2>
              <div className="mt-3 space-y-3">
                {[
                  ["AI edits", usage.ai_edits, usage.limits.ai_edits],
                  ["Render minutes", usage.render_minutes, usage.limits.render_minutes],
                  ["Storage (MB)", usage.storage_mb, usage.limits.storage_mb],
                ].map(([label, used, limit]) => (
                  <div key={String(label)}>
                    <div className="flex justify-between text-2xs text-neutral-400">
                      <span>{label}</span>
                      <span className="font-mono">{Number(used)}/{Number(limit)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-studio-800">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct(Number(used), Number(limit))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Jobs</h2>
              <ul className="mt-2 space-y-2">
                {demoJobs.map((job) => (
                  <li key={job.id} className="flex items-start gap-2 text-2xs">
                    <Badge tone={job.status === "succeeded" ? "success" : job.status === "queued" ? "warning" : "info"}>{job.status}</Badge>
                    <span className="min-w-0 flex-1 text-neutral-400">{job.message}</span>
                  </li>
                ))}
              </ul>
              <Link href="/rendering" className="mt-3 inline-block text-2xs text-amber-300 hover:text-amber-200">Render queue →</Link>
            </section>
          </div>
        </div>

        <section className="rounded-xl border border-studio-800 bg-studio-900/60">
          <header className="flex items-center justify-between border-b border-studio-800 px-4 py-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Model status</h2>
            <span className="text-2xs text-neutral-500">Licence-checked before enabling</span>
          </header>
          <ul className="divide-y divide-studio-800">
            {demoModels.map((model) => (
              <li key={model.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-2xs">
                <span className="min-w-40 text-xs text-neutral-200">{model.name}</span>
                <span className="text-neutral-500">{model.task}</span>
                <span className="ml-auto flex items-center gap-2">
                  <Badge tone={model.status === "available" ? "success" : model.status === "adapter_only" ? "info" : "neutral"}>
                    {model.status.replace("_", " ")}
                  </Badge>
                  <Badge tone={model.commercial_use === "allowed" ? "success" : model.commercial_use === "restricted" ? "warning" : "neutral"}>
                    {model.commercial_use}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
