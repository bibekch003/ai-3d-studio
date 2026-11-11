"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Field, Select, TextInput, Toggle } from "@ai3d/ui";
import { AppShell } from "@/components/AppShell";
import { demoJobs } from "@/lib/demo-data";
import { api } from "@/lib/api";
import { gpuJobsEnabled, isApiConfigured } from "@/lib/product";
import { useStudio } from "@/lib/store";
import type { JobRecord, RenderRequest } from "@ai3d/shared-types";

export default function RenderingPage() {
  const scene = useStudio((s) => s.scene);
  const notify = useStudio((s) => s.notify);
  const [jobs, setJobs] = useState<JobRecord[]>(demoJobs);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<RenderRequest>({
    scene_id: scene.id,
    engine: "eevee",
    resolution: "1920x1080",
    fps: 24,
    samples: 64,
    frame_range: [0, scene.settings.duration_frames],
    format: "mp4",
  });

  async function submit() {
    setBusy(true);
    if (!isApiConfigured) {
      setBusy(false);
      notify("No render worker connected: use Record in the studio for a WebM preview, or configure the API + worker.", "warning");
      return;
    }
    try {
      const job = await api.createRender(form);
      setJobs([job, ...jobs]);
      notify(`Render job ${job.id} queued`, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Render request failed", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Rendering" subtitle="Browser preview now, Blender worker when connected">
      <div className="space-y-4">
        <section className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-emerald-200">Preview render (works right now)</h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-neutral-300">
                In the studio, press <span className="text-emerald-200">Record</span> to capture the animated viewport to a WebM
                file, or <span className="text-emerald-200">Still</span> for a PNG of the current frame. This is a real file at
                viewport quality — no ray tracing, denoising or motion blur.
              </p>
            </div>
            <Link href="/studio" className="rounded-md bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-neutral-950 hover:bg-emerald-300">
              Open studio and record
            </Link>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <section className="space-y-3 rounded-xl border border-studio-800 bg-studio-900/60 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Final render (Blender worker)</h2>
              <Badge tone={isApiConfigured ? "info" : "warning"}>{isApiConfigured ? "API configured" : "no worker"}</Badge>
            </div>
            <Field label="Engine">
              <Select
                value={form.engine}
                onChange={(e) => setForm({ ...form, engine: e.target.value as RenderRequest["engine"] })}
                options={[
                  { value: "eevee", label: "EEVEE — fast preview" },
                  { value: "cycles", label: "Cycles — final quality" },
                ]}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Resolution">
                <Select
                  value={form.resolution}
                  onChange={(e) => setForm({ ...form, resolution: e.target.value as RenderRequest["resolution"] })}
                  options={[
                    { value: "1920x1080", label: "1080p" },
                    { value: "2560x1440", label: "1440p" },
                    { value: "3840x2160", label: gpuJobsEnabled ? "4K (GPU worker)" : "4K (needs GPU worker)" },
                  ]}
                />
              </Field>
              <Field label="Frame rate">
                <Select
                  value={String(form.fps)}
                  onChange={(e) => setForm({ ...form, fps: Number(e.target.value) as RenderRequest["fps"] })}
                  options={[{ value: "24", label: "24" }, { value: "25", label: "25" }, { value: "30", label: "30" }, { value: "60", label: "60" }]}
                />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Samples">
                <TextInput type="number" min={1} max={8192} value={form.samples} onChange={(e) => setForm({ ...form, samples: Number(e.target.value) })} />
              </Field>
              <Field label="From">
                <TextInput type="number" min={0} value={form.frame_range[0]} onChange={(e) => setForm({ ...form, frame_range: [Number(e.target.value), form.frame_range[1]] })} />
              </Field>
              <Field label="To">
                <TextInput type="number" min={1} value={form.frame_range[1]} onChange={(e) => setForm({ ...form, frame_range: [form.frame_range[0], Number(e.target.value)] })} />
              </Field>
            </div>
            <Field label="Format">
              <Select
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value as RenderRequest["format"] })}
                options={[
                  { value: "mp4", label: "MP4 (H.264)" },
                  { value: "png_sequence", label: "PNG sequence" },
                  { value: "exr_sequence", label: "EXR sequence" },
                  { value: "blend", label: ".blend project" },
                ]}
              />
            </Field>
            <Toggle label="Denoise" checked={scene.settings.denoise} onChange={() => notify("Change denoise in the studio's scene settings", "info")} />
            <Button variant="primary" className="w-full" loading={busy} onClick={() => void submit()}>
              Queue Blender render
            </Button>
            <p className="text-[10px] leading-relaxed text-neutral-500">
              Blender rendering needs the render worker container (Redis + Blender 5.2 LTS). Until it is connected this button
              tells you so instead of pretending a job started.
            </p>
          </section>

          <section className="rounded-xl border border-studio-800 bg-studio-900/60">
            <header className="flex items-center justify-between border-b border-studio-800 px-3 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Queue</h2>
              <Badge tone="neutral">{jobs.length} jobs</Badge>
            </header>
            <ul className="divide-y divide-studio-800">
              {jobs.map((job) => (
                <li key={job.id} className="space-y-1 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={job.status === "succeeded" ? "success" : job.status === "failed" ? "danger" : job.status === "running" ? "info" : "warning"}>
                      {job.status}
                    </Badge>
                    <span className="text-2xs text-neutral-300">{job.kind}</span>
                    <span className="ml-auto font-mono text-[10px] text-neutral-600">{job.id}</span>
                  </div>
                  <p className="text-2xs text-neutral-400">{job.message}</p>
                  <div className="h-1 overflow-hidden rounded-full bg-studio-800">
                    <div className="h-full bg-amber-400" style={{ width: `${job.progress}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-studio-800 p-3 text-[10px] leading-relaxed text-neutral-500">
              Jobs are illustrative until the API is configured; the queue is read from <span className="font-mono">/api/v1/jobs</span>{" "}
              when it is.
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
