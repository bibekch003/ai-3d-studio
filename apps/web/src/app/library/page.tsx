"use client";

import { useState } from "react";
import { Badge, Tabs } from "@ai3d/ui";
import { MATERIAL_PRESETS, buildDemoScene } from "@ai3d/scene-core";
import { AppShell } from "@/components/AppShell";

const ENVIRONMENT_PRESETS = [
  { id: "room.domestic.small", name: "Small domestic room", kind: "interior", note: "3 walls, window, 6×3×6 m" },
  { id: "room.lab.futuristic", name: "Futuristic laboratory", kind: "interior", note: "emissive strips, hard surfaces" },
  { id: "room.kitchen.modern", name: "Modern kitchen", kind: "interior", note: "island, cabinets, window" },
  { id: "room.office.open", name: "Open-plan office", kind: "interior", note: "desks, partitions" },
  { id: "landscape.forest.temperate", name: "Temperate forest", kind: "exterior", note: "terrain + 400 instanced trees" },
  { id: "landscape.beach.tropical", name: "Tropical beach", kind: "exterior", note: "shore, palms, ocean" },
  { id: "urban.street.narrow", name: "Narrow street", kind: "exterior", note: "facades, lamps, wet road" },
  { id: "studio.cyc.infinity", name: "Cyclorama studio", kind: "studio", note: "seamless backdrop, 3-point light" },
];

export default function LibraryPage() {
  const [tab, setTab] = useState("materials");
  const scene = buildDemoScene();

  return (
    <AppShell title="Library" subtitle="Shared materials, environment recipes and clip presets">
      <div className="space-y-4">
        <Tabs
          tabs={[
            { id: "materials", label: "Materials" },
            { id: "environments", label: "Environments" },
            { id: "lights", label: "Lighting" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "materials" ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(MATERIAL_PRESETS).map(([key, preset]) => (
              <li key={key} className="flex items-center gap-3 rounded-xl border border-studio-800 bg-studio-900/60 p-3">
                <span className="size-9 shrink-0 rounded-md border border-studio-700" style={{ background: preset.base_color }} />
                <div className="min-w-0">
                  <p className="truncate text-xs text-neutral-100">{preset.name ?? key}</p>
                  <p className="font-mono text-[10px] text-neutral-500">
                    {key} · r{preset.roughness} · m{preset.metallic}
                    {preset.procedural ? ` · ${preset.procedural.id}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {tab === "environments" ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {ENVIRONMENT_PRESETS.map((env) => (
              <li key={env.id} className="rounded-xl border border-studio-800 bg-studio-900/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-neutral-100">{env.name}</p>
                  <Badge tone="neutral">{env.kind}</Badge>
                </div>
                <p className="font-mono text-[10px] text-neutral-600">{env.id}</p>
                <p className="mt-1 text-2xs text-neutral-500">{env.note}</p>
              </li>
            ))}
          </ul>
        ) : null}

        {tab === "lights" ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {scene.objects
              .filter((o) => o.type === "light")
              .map((light) => (
                <li key={light.id} className="rounded-xl border border-studio-800 bg-studio-900/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-neutral-100">{light.name}</p>
                    <Badge tone="info">{light.light?.role}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-neutral-500">
                    {light.light?.kind} · {light.light?.intensity_watts} W · {light.light?.color_temperature_k ?? "—"} K ·{" "}
                    {light.light?.color}
                  </p>
                </li>
              ))}
          </ul>
        ) : null}
      </div>
    </AppShell>
  );
}
