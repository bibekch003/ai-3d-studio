"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Button, EmptyState, Field, TextInput } from "@ai3d/ui";
import { AppShell } from "@/components/AppShell";
import { demoProjects } from "@/lib/demo-data";
import type { Project } from "@ai3d/shared-types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>(demoProjects);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () => projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
    [projects, query],
  );

  function createProject() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Give the project a name of at least 2 characters.");
      return;
    }
    const project: Project = {
      id: `prj_local_${Date.now()}`,
      owner_id: "demo",
      name: trimmed,
      description: "Created in the demo workspace",
      cover_asset_id: null,
      fps: 24,
      default_resolution: "1920x1080",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      scene_count: 1,
      role: "owner",
    };
    setProjects([project, ...projects]);
    setName("");
    setCreating(false);
    setError(null);
  }

  return (
    <AppShell
      title="Projects"
      subtitle="Every project holds scenes, assets and render history"
      actions={<Button variant="primary" size="sm" onClick={() => setCreating((v) => !v)}>New project</Button>}
    >
      <div className="space-y-4">
        {creating ? (
          <div className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <Field label="Project name" htmlFor="project-name" hint="2–80 characters">
                  <TextInput
                    id="project-name"
                    value={name}
                    maxLength={80}
                    placeholder="Night market chase"
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
              </div>
              <Button variant="primary" onClick={createProject}>Create</Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
            {error ? <p className="mt-2 text-2xs text-red-300">{error}</p> : null}
            <p className="mt-2 text-2xs text-neutral-500">
              In this demo the project is kept in memory. With the API configured it is persisted to Postgres and a starter scene
              is generated.
            </p>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <TextInput
            aria-label="Search projects"
            placeholder="Search projects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs"
          />
          <span className="text-2xs text-neutral-500">{filtered.length} of {projects.length}</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No projects match"
            body="Try a different search, or create a project to start from the demo scene."
            action={<Button variant="secondary" onClick={() => setQuery("")}>Clear search</Button>}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => (
              <li key={project.id} className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-medium text-neutral-100">{project.name}</h2>
                  <Badge tone={project.role === "owner" ? "success" : "info"}>{project.role}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-2xs leading-relaxed text-neutral-500">{project.description}</p>
                <dl className="mt-3 grid grid-cols-2 gap-1 text-2xs text-neutral-500">
                  <div><dt className="inline">Scenes: </dt><dd className="inline text-neutral-300">{project.scene_count}</dd></div>
                  <div><dt className="inline">FPS: </dt><dd className="inline text-neutral-300">{project.fps}</dd></div>
                  <div><dt className="inline">Res: </dt><dd className="inline text-neutral-300">{project.default_resolution}</dd></div>
                  <div><dt className="inline">Updated: </dt><dd className="inline text-neutral-300">{new Date(project.updated_at).toLocaleDateString("en-IN")}</dd></div>
                </dl>
                <div className="mt-3 flex gap-2">
                  <Link href="/studio" className="rounded-md bg-amber-400 px-2.5 py-1 text-2xs font-semibold text-neutral-950 hover:bg-amber-300">
                    Open studio
                  </Link>
                  <Link href="/animation" className="rounded-md border border-studio-700 px-2.5 py-1 text-2xs text-neutral-300 hover:bg-studio-800">
                    Timeline
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
