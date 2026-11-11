"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, EmptyState, Field, Select, Slider } from "@ai3d/ui";
import { buildDemoScene, type SceneObject } from "@ai3d/scene-core";
import { AppShell } from "@/components/AppShell";
import { useStudio } from "@/lib/store";

const scene = buildDemoScene();
const characters = scene.objects.filter((o) => o.type === "character");

export default function CharactersPage() {
  const [selectedId, setSelectedId] = useState(characters[0]?.id ?? "");
  const [hair, setHair] = useState<string>("hair.short_tousled");
  const [smile, setSmile] = useState(0.15);
  const setScene = useStudio((s) => s.setScene);
  const notify = useStudio((s) => s.notify);

  const character: SceneObject | undefined = characters.find((c) => c.id === selectedId);

  return (
    <AppShell
      title="Character Studio"
      subtitle="Identity-preserving character profiles, reusable across shots"
      actions={<Badge tone="neutral">{characters.length} characters</Badge>}
    >
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <section className="rounded-xl border border-studio-800 bg-studio-900/60">
          <header className="border-b border-studio-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Library</header>
          <ul className="divide-y divide-studio-800">
            {characters.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={c.id === selectedId ? "w-full bg-amber-400/10 px-3 py-2 text-left" : "w-full px-3 py-2 text-left hover:bg-studio-850"}
                >
                  <p className="text-xs text-neutral-100">{c.name}</p>
                  <p className="font-mono text-[10px] text-neutral-500">{c.character?.identity_id}</p>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-studio-800 p-3">
            <Button
              size="sm"
              variant="subtle"
              className="w-full"
              onClick={() => notify("Character creation needs the character service and a rigged asset library entry. Not enabled in this build.", "warning")}
            >
              New character
            </Button>
            <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
              A new character requires a rigged mesh in the asset library; generative body creation is an adapter, not bundled.
            </p>
          </div>
        </section>

        {character?.character ? (
          <div className="space-y-4">
            <section className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-100">{character.name}</h2>
                  <p className="text-2xs text-neutral-500">
                    {character.character.age_band} · {character.character.proportions.height_m} m ·{" "}
                    {character.character.proportions.build} build
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href="/studio"
                    onClick={() => setScene(scene)}
                    className="rounded-md bg-amber-400 px-2.5 py-1 text-2xs font-semibold text-neutral-950 hover:bg-amber-300"
                  >
                    Open in studio
                  </Link>
                </div>
              </div>
              <dl className="mt-3 grid gap-2 text-2xs sm:grid-cols-2">
                <div>
                  <dt className="text-neutral-500">Identity locked</dt>
                  <dd className="text-neutral-300">{character.character.identity_locked.join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Rig</dt>
                  <dd className="font-mono text-neutral-300">{character.character.pose.rig_id}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Wardrobe</dt>
                  <dd className="text-neutral-300">{character.character.wardrobe.map((w) => w.garment_id).join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Children</dt>
                  <dd className="text-neutral-300">
                    {scene.objects.filter((o) => o.parent_id === character.id).map((o) => o.name).join(", ")}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Variation preview</h2>
              <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">
                These controls stage a variation. In the studio they compile to a validated <span className="font-mono">set_character</span>{" "}
                operation that keeps the face and identity untouched.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Hair style">
                  <Select
                    value={hair}
                    options={["hair.short_tousled", "hair.short_crop", "hair.buzz", "hair.long_wave", "hair.curly_medium", "hair.bun"].map((v) => ({ value: v, label: v.replace("hair.", "") }))}
                    onChange={(e) => setHair(e.target.value)}
                  />
                </Field>
                <div className="space-y-1">
                  <Slider label="Smile" min={0} max={1} value={smile} onChange={setSmile} />
                </div>
              </div>
              <Button
                className="mt-3"
                variant="secondary"
                onClick={() => {
                  setScene(scene);
                  notify(`Staged variation: ${hair.replace("hair.", "")}, smile ${smile.toFixed(2)}. Open the studio to apply it.`, "info");
                }}
              >
                Stage variation in studio
              </Button>
            </section>
          </div>
        ) : (
          <EmptyState title="No character selected" body="Pick a character from the library to inspect its identity, rig and wardrobe." />
        )}
      </div>
    </AppShell>
  );
}
