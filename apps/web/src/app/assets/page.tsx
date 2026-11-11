"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Select, TextInput } from "@ai3d/ui";
import { AppShell } from "@/components/AppShell";
import { demoAssets } from "@/lib/demo-data";

const KINDS = ["all", "model", "texture", "hdri", "audio", "image", "video"];

export default function AssetsPage() {
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(
    () =>
      demoAssets.filter(
        (a) => (kind === "all" || a.kind === kind) && a.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [kind, query],
  );

  return (
    <AppShell
      title="Assets"
      subtitle="Models, textures, HDRIs and audio with licence tracking"
      actions={
        <Button
          size="sm"
          variant="subtle"
          title="Uploads need the API and Supabase Storage. Not connected in this demo build."
          onClick={() => alert("Uploads require the API service and Supabase Storage.\nThis static demo has no backend, so no file can be stored.")}
        >
          Upload (needs API)
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <TextInput placeholder="Search assets" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" aria-label="Search assets" />
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            options={KINDS.map((k) => ({ value: k, label: k }))}
            aria-label="Filter by kind"
            className="max-w-36"
          />
          <span className="text-2xs text-neutral-500">{rows.length} assets</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-studio-800">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-studio-900 text-2xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Format</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Licence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-studio-800">
              {rows.map((asset) => (
                <tr key={asset.id} className="hover:bg-studio-900/60">
                  <td className="px-3 py-2">
                    <p className="text-neutral-100">{asset.name}</p>
                    <p className="font-mono text-[10px] text-neutral-600">{asset.id}</p>
                  </td>
                  <td className="px-3 py-2"><Badge tone="neutral">{asset.kind}</Badge></td>
                  <td className="px-3 py-2 font-mono text-2xs text-neutral-400">{asset.format}</td>
                  <td className="px-3 py-2 text-2xs text-neutral-400">{(asset.size_bytes / 1_000_000).toFixed(1)} MB</td>
                  <td className="px-3 py-2 text-2xs text-neutral-400">{asset.source}</td>
                  <td className="px-3 py-2 text-2xs text-neutral-400">{asset.licence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="rounded border border-studio-800 bg-studio-900/60 p-2 text-[10px] leading-relaxed text-neutral-400">
          This is sample library data. Uploads require the API service and a storage bucket; the static demo cannot accept files.
        </p>
        <p className="text-[10px] leading-relaxed text-neutral-500">
          Uploads are validated for type and size, stored in Supabase Storage, and recorded with their licence. An asset without a
          licence note is blocked from commercial render presets.
        </p>
      </div>
    </AppShell>
  );
}
