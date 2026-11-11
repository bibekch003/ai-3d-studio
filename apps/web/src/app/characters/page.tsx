"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge, Button, EmptyState, Field, Select, Slider } from "@ai3d/ui";
import { AppShell } from "@/components/AppShell";
import { useStudio } from "@/lib/store";

const HAIR_STYLES = ["hair.short_tousled", "hair.short_crop", "hair.buzz", "hair.long_wave", "hair.curly_medium", "hair.bun"];

export default function CharactersPage() {
  const router = useRouter();
  const scene = useStudio((s) => s.scene);
  const applyOps = useStudio((s) => s.applyOps);
  const select = useStudio((s) => s.select);
  const newScene = useStudio((s) => s.newScene);
  const notify = useStudio((s) => s.notify);

  const characters = useMemo(() => scene.objects.filter((o) => o.type === "character"), [scene.objects]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [hair, setHair] = useState("hair.short_tousled");
  const [smile, setSmile] = useState(0.2);

  const character = characters.find((c) => c.id === (selectedId || characters[0]?.id)) ?? characters[0];

  function openInStudio(id: string) {
    select(id);
    router.push("/studio");
  }

  function stageVariation(id: string) {
    const ok = applyOps(
      [{ op: "set_character", target_id: id, params: { patch: { hair: { style_id: hair }, expression: { mouth_smile: smile } } } }],
      "Character variation",
    );
    if (ok) {
      select(id);
      notify("Variation applied — undo with Ctrl+Z in the studio", "success");
      router.push("/studio");
    }
  }

  return (
    <AppShell
      title="Character Studio"
      subtitle="Identity-preserving character profiles, reusable across shots"
      actions={<Badge tone="neutral">{characters.length} in this scene</Badge>}
    >
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <section className="rounded-xl border border-studio-800 bg-studio-900/60">
          <header className="border-b border-studio-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">Cast</header>
          {characters.length ? (
            <ul className="divide-y divide-studio-800">
              {characters.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={c.id === character?.id ? "w-full bg-amber-400/10 px-3 py-2 text-left" : "w-full px-3 py-2 text-left hover:bg-studio-850"}
                  >
                    <p className="text-xs text-neutral-100">{c.name}</p>
                    <p className="font-mono text-[10px] text-neutral-500">{c.character?.identity_id}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-3 text-[10px] leading-relaxed text-neutral-500">
              This scene has no characters. Build one from a sentence:
            </div>
          )}
          <div className="border-t border-studio-800 p-3">
            <Button
              size="sm"
              variant="subtle"
              className="w-full"
              onClick={() => {
                const result = newScene("prompt", "A young woman stands in a small room and looks at the camera.");
                if (result.ok) router.push("/studio");
              }}
            >
              Build a scene with a character
            </Button>
            <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
              A generated body needs a rigged mesh in the asset library; this build creates a rigged placeholder you can pose,
              dress and animate.
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
                    {character.character.age_band} · {character.character.proportions.height_m} m · {character.character.proportions.build} build
                  </p>
                </div>
                <Button size="sm" variant="primary" onClick={() => openInStudio(character.id)}>
                  Open in studio
                </Button>
              </div>
              <dl className="mt-3 grid gap-2 text-2xs sm:grid-cols-2">
                <div>
                  <dt className="text-neutral-500">Identity locked</dt>
                  <dd className="text-neutral-300">{character.character.identity_locked.join(", ") || "none"}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Rig</dt>
                  <dd className="font-mono text-neutral-300">{character.character.pose.rig_id}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Wardrobe</dt>
                  <dd className="text-neutral-300">{character.character.wardrobe.map((w) => w.garment_id).join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Parts</dt>
                  <dd className="text-neutral-300">
                    {scene.objects.filter((o) => o.parent_id === character.id).map((o) => o.name).join(", ")}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-studio-800 bg-studio-900/60 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Stage a variation</h2>
              <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">
                Compiles to a validated <span className="font-mono">set_character</span> operation that leaves the face and identity
                untouched, then opens the studio with the change applied.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Hair style">
                  <Select value={hair} options={HAIR_STYLES.map((v) => ({ value: v, label: v.replace("hair.", "") }))} onChange={(e) => setHair(e.target.value)} />
                </Field>
                <div className="space-y-1">
                  <Slider label="Smile" min={0} max={1} value={smile} onChange={setSmile} />
                </div>
              </div>
              <Button className="mt-3" variant="secondary" onClick={() => stageVariation(character.id)}>
                Apply variation and open studio
              </Button>
            </section>
          </div>
        ) : (
          <EmptyState
            title="No character in this scene"
            body="Build a scene from a sentence to create a rigged placeholder character you can edit part by part."
            action={<Button variant="primary" onClick={() => { newScene("prompt", "A young man enters a room and looks around."); router.push("/studio"); }}>Build a character scene</Button>}
          />
        )}
      </div>
    </AppShell>
  );
}
