"use client";

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
      notify("No render worker is configured, so no job was created. Set NEXT_PUBLIC_API_BASE_URL and run the render service.", "warning");
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
    <AppShell title="Rendering" subtitle="Blender worker: EEVEE previews, Cycles finals, editable .blend export">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="space-y-3 rounded-xl border border-studio-800 bg-studio-900/60 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">New render</h2>
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
          <Toggle label="Denoise" checked onChange={() => undefined} disabled hint="scene setting" />
          <Button variant="primary" className="w-full" loading={busy} onClick={() => void submit()}>
            Queue render
          </Button>
          <p className="text-[10px] leading-relaxed text-neutral-500">
            4K and 60 fps require a GPU worker and are disabled unless <span className="font-mono">NEXT_PUBLIC_ENABLE_GPU_JOBS</span>{" "}
            is true. Unsupported combinations are never advertised as available.
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
            Jobs run in a separate worker container with Blender installed. The API never renders inside a request; it enqueues and
            streams progress over SSE/WebSocket.
          </div>
        </section>
      </div>
    </AppShell>
  );
}
