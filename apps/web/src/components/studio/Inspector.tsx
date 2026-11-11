"use client";

import { useMemo } from "react";
import { Badge, Field, SectionTitle, Select, Slider, TextInput, Toggle } from "@ai3d/ui";
import { objectPath, sceneStats, type CharacterPatch, type SceneObject } from "@ai3d/scene-core";
import { useStudio } from "@/lib/store";

function NumberField({
  label,
  value,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-2xs text-neutral-500">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? Number(value.toFixed(4)) : 0}
        step={step}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="w-full rounded border border-studio-700 bg-studio-950 px-1.5 py-1 font-mono text-2xs text-neutral-200 focus:border-amber-400 focus:outline-none"
      />
    </label>
  );
}

function VectorField({
  label,
  value,
  onChange,
  degrees,
}: {
  label: string;
  value: [number, number, number];
  onChange: (v: [number, number, number]) => void;
  degrees?: boolean;
}) {
  const factor = degrees ? Math.PI / 180 : 1;
  return (
    <div className="space-y-1">
      <p className="text-2xs text-neutral-500">{label}{degrees ? " (°)" : ""}</p>
      <div className="grid grid-cols-3 gap-1">
        {(["X", "Y", "Z"] as const).map((axis, i) => (
          <label key={axis} className="flex items-center gap-1 rounded border border-studio-700 bg-studio-950 px-1">
            <span className="text-[9px] text-neutral-600">{axis}</span>
            <input
              type="number"
              step={degrees ? 1 : 0.01}
              value={Number((value[i]! / factor).toFixed(3))}
              onChange={(e) => {
                const next = [...value] as [number, number, number];
                const parsed = Number(e.target.value);
                next[i] = Number.isFinite(parsed) ? parsed * factor : 0;
                onChange(next);
              }}
              className="w-full bg-transparent py-1 font-mono text-2xs text-neutral-200 focus:outline-none"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function TransformSection({ obj }: { obj: SceneObject }) {
  const applyOps = useStudio((s) => s.applyOps);
  return (
    <section className="space-y-2">
      <SectionTitle hint={obj.locked ? "locked" : undefined}>Transform</SectionTitle>
      <VectorField label="Position (m)" value={obj.transform.position} onChange={(position) => applyOps([{ op: "set_transform", target_id: obj.id, params: { position } }], `Move ${obj.name}`)} />
      <VectorField label="Rotation" degrees value={obj.transform.rotation} onChange={(rotation) => applyOps([{ op: "set_transform", target_id: obj.id, params: { rotation } }], `Rotate ${obj.name}`)} />
      <VectorField label="Scale" value={obj.transform.scale} onChange={(scale) => applyOps([{ op: "set_transform", target_id: obj.id, params: { scale } }], `Scale ${obj.name}`)} />
    </section>
  );
}

function MaterialSection({ obj }: { obj: SceneObject }) {
  const scene = useStudio((s) => s.scene);
  const applyOps = useStudio((s) => s.applyOps);
  const base = scene.materials.find((m) => m.id === obj.material_id);
  const merged = { ...(base ?? { base_color: "#8a8a8a", roughness: 0.7, metallic: 0, name: "inline" }), ...(obj.material_overrides ?? {}) };

  return (
    <section className="space-y-2">
      <SectionTitle hint={base ? `library: ${base.name}` : "no library material"}>Material</SectionTitle>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label="Base colour"
          value={merged.base_color}
          onChange={(e) => applyOps([{ op: "set_material", target_id: obj.id, params: { patch: { base_color: e.target.value } } }], `Colour ${obj.name}`)}
          className="h-7 w-10 cursor-pointer rounded border border-studio-700 bg-studio-950"
        />
        <span className="font-mono text-2xs text-neutral-400">{merged.base_color}</span>
      </div>
      <Slider label="Roughness" min={0} max={1} value={merged.roughness} onChange={(roughness) => applyOps([{ op: "set_material", target_id: obj.id, params: { patch: { roughness } } }], `Roughness ${obj.name}`)} />
      <Slider label="Metallic" min={0} max={1} value={merged.metallic} onChange={(metallic) => applyOps([{ op: "set_material", target_id: obj.id, params: { patch: { metallic } } }], `Metallic ${obj.name}`)} />
      <p className="text-[10px] leading-relaxed text-neutral-500">
        Overrides are stored per object; the shared material in the library is untouched.
      </p>
    </section>
  );
}

const HAIR_STYLES = ["hair.short_crop", "hair.short_tousled", "hair.buzz", "hair.long_wave", "hair.curly_medium", "hair.bun", "hair.ponytail", "hair.none"];

function CharacterSection({ obj }: { obj: SceneObject }) {
  const applyOps = useStudio((s) => s.applyOps);
  const c = obj.character;
  if (!c) return <p className="text-2xs text-neutral-500">This character has no character state; attach a rig profile.</p>;

  const patch = (p: { patch: CharacterPatch }) =>
    applyOps([{ op: "set_character", target_id: obj.id, params: p }], `Edit character ${obj.name}`);

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <SectionTitle hint="identity">Appearance</SectionTitle>
        <Field label="Identity id">
          <TextInput value={c.identity_id} readOnly className="font-mono text-2xs" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Age band">
            <Select
              value={c.age_band ?? "unspecified"}
              options={["child", "teen", "adult", "senior", "unspecified"].map((v) => ({ value: v, label: v }))}
              onChange={(e) => patch({ patch: { age_band: e.target.value as never } })}
            />
          </Field>
          <Field label="Height (m)">
            <TextInput
              type="number"
              step={0.01}
              value={c.proportions.height_m}
              onChange={(e) => patch({ patch: { proportions: { height_m: Number(e.target.value) } } })}
            />
          </Field>
        </div>
        <p className="text-[10px] text-neutral-500">Identity lock: {c.identity_locked.join(", ") || "none"}</p>
      </section>

      <section className="space-y-2">
        <SectionTitle hint="hair">Hair</SectionTitle>
        <Select
          value={c.hair.style_id}
          options={HAIR_STYLES.map((v) => ({ value: v, label: v.replace("hair.", "") }))}
          onChange={(e) => patch({ patch: { hair: { style_id: e.target.value } } })}
        />
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Hair colour"
            value={c.hair.color}
            onChange={(e) => patch({ patch: { hair: { color: e.target.value } } })}
            className="h-7 w-10 cursor-pointer rounded border border-studio-700 bg-studio-950"
          />
          <span className="font-mono text-2xs text-neutral-400">{c.hair.color}</span>
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle hint="blend shapes">Face &amp; expression</SectionTitle>
        {Object.entries({ mouth_smile: c.expression.mouth_smile ?? 0, brow_neutral: c.expression.brow_neutral ?? 0, jaw_open: c.expression.jaw_open ?? 0 }).map(([shape, value]) => (
          <Slider
            key={shape}
            label={shape.replace(/_/g, " ")}
            min={0}
            max={1}
            value={value}
            onChange={(v) => patch({ patch: { expression: { [shape]: v } } })}
          />
        ))}
      </section>

      <section className="space-y-2">
        <SectionTitle hint="wardrobe">Clothing</SectionTitle>
        <ul className="space-y-1">
          {c.wardrobe.map((item, i) => (
            <li key={`${item.garment_id}-${i}`} className="flex items-center gap-2 text-2xs text-neutral-300">
              <span className="h-3 w-3 rounded-full border border-studio-700" style={{ background: item.color }} />
              <span className="truncate">{item.garment_id}</span>
              <span className="ml-auto font-mono text-neutral-500">{item.material_id ?? "inline"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-1">
        <SectionTitle hint="rig">Rigging</SectionTitle>
        <p className="text-2xs text-neutral-400">Rig: <span className="font-mono">{c.pose.rig_id}</span></p>
        <p className="text-2xs text-neutral-400">Bone overrides: {Object.keys(c.pose.bone_rotations).length}</p>
        <p className="text-[10px] leading-relaxed text-neutral-500">
          Skeleton editing is handled by the animation studio; this panel edits the resolved pose values.
        </p>
      </section>
    </div>
  );
}

function CameraSection({ obj }: { obj: SceneObject }) {
  const applyOps = useStudio((s) => s.applyOps);
  const cam = obj.camera;
  if (!cam) return null;
  const set = (patch: Record<string, unknown>) => applyOps([{ op: "set_camera", target_id: obj.id, params: { patch: patch as never } }], `Camera ${obj.name}`);

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <SectionTitle hint="lens">Camera</SectionTitle>
        <Slider label="Focal length" min={8} max={200} step={1} value={cam.focal_length_mm} format={(v) => `${v} mm`} onChange={(focal_length_mm) => set({ focal_length_mm })} />
        <Slider label="Aperture" min={1} max={16} step={0.1} value={cam.fstop} format={(v) => `f/${v}`} onChange={(fstop) => set({ fstop })} />
        <Slider label="Focus distance" min={0.1} max={20} step={0.05} value={cam.focus_distance_m} format={(v) => `${v.toFixed(2)} m`} onChange={(focus_distance_m) => set({ focus_distance_m })} />
        <Toggle label="Depth of field" checked={cam.dof_enabled} onChange={(dof_enabled) => set({ dof_enabled })} />
      </section>
      <section className="space-y-2">
        <SectionTitle hint="framing">Shot</SectionTitle>
        <Field label="Shot type">
          <Select
            value={cam.shot_type}
            options={["extreme_wide", "wide", "medium", "close_up", "extreme_close_up", "over_the_shoulder", "pov"].map((v) => ({ value: v, label: v.replace(/_/g, " ") }))}
            onChange={(e) => set({ shot_type: e.target.value })}
          />
        </Field>
        <Field label="Movement">
          <Select
            value={cam.movement}
            options={["static", "pan", "tilt", "dolly", "truck", "crane", "handheld", "orbit"].map((v) => ({ value: v, label: v }))}
            onChange={(e) => set({ movement: e.target.value })}
          />
        </Field>
      </section>
    </div>
  );
}

function LightSection({ obj }: { obj: SceneObject }) {
  const applyOps = useStudio((s) => s.applyOps);
  const light = obj.light;
  if (!light) return null;
  const set = (patch: Record<string, unknown>) => applyOps([{ op: "set_light", target_id: obj.id, params: { patch: patch as never } }], `Light ${obj.name}`);

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <SectionTitle hint={light.role}>Light</SectionTitle>
        <Field label="Type">
          <Select value={light.kind} options={["point", "spot", "sun", "area"].map((v) => ({ value: v, label: v }))} onChange={(e) => set({ kind: e.target.value })} />
        </Field>
        <Slider label="Intensity" min={0} max={1000} step={1} value={light.intensity_watts} format={(v) => `${v} W`} onChange={(intensity_watts) => set({ intensity_watts })} />
        <Slider label="Softness" min={0} max={1} value={light.softness} onChange={(softness) => set({ softness })} />
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Light colour"
            value={light.color}
            onChange={(e) => set({ color: e.target.value })}
            className="h-7 w-10 cursor-pointer rounded border border-studio-700 bg-studio-950"
          />
          <span className="font-mono text-2xs text-neutral-400">{light.color}</span>
        </div>
        <Toggle label="Cast shadows" checked={light.shadows} onChange={(shadows) => set({ shadows })} />
        <VectorField label="Direction" value={light.direction} onChange={(direction) => set({ direction })} />
      </section>
    </div>
  );
}

function EnvironmentSection() {
  const scene = useStudio((s) => s.scene);
  const applyOps = useStudio((s) => s.applyOps);
  const env = scene.environment;
  const set = (patch: Record<string, unknown>) => applyOps([{ op: "set_environment", target_id: null, params: { patch: patch as never } }], "Edit environment");

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <SectionTitle hint={env.preset_id}>Environment</SectionTitle>
        <Field label="Kind">
          <Select value={env.kind} options={["interior", "exterior", "studio", "abstract"].map((v) => ({ value: v, label: v }))} onChange={(e) => set({ kind: e.target.value })} />
        </Field>
        <Field label="Time of day">
          <Select
            value={env.time_of_day}
            options={["dawn", "morning", "noon", "afternoon", "sunset", "dusk", "night"].map((v) => ({ value: v, label: v }))}
            onChange={(e) => set({ time_of_day: e.target.value })}
          />
        </Field>
        <Field label="Weather">
          <Select
            value={env.weather}
            options={["clear", "cloudy", "overcast", "rain", "snow", "fog", "storm"].map((v) => ({ value: v, label: v }))}
            onChange={(e) => set({ weather: e.target.value })}
          />
        </Field>
        <Field label="Global style">
          <Select
            value={env.global_style}
            options={["photoreal", "cinematic", "stylised", "anime", "clay_render", "low_poly", "noir", "custom"].map((v) => ({ value: v, label: v.replace("_", " ") }))}
            onChange={(e) => applyOps([{ op: "set_global_style", target_id: null, params: { style: e.target.value as never } }], "Set visual style")}
          />
        </Field>
      </section>
      <section className="space-y-2">
        <SectionTitle hint="atmosphere">Sky &amp; fog</SectionTitle>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Sky colour"
            value={env.sky.color}
            onChange={(e) => set({ sky: { ...env.sky, color: e.target.value } })}
            className="h-7 w-10 cursor-pointer rounded border border-studio-700 bg-studio-950"
          />
          <span className="font-mono text-2xs text-neutral-400">{env.sky.color}</span>
        </div>
        <Slider label="Fog density" min={0} max={1} value={env.atmosphere.fog_density} onChange={(fog_density) => set({ atmosphere: { ...env.atmosphere, fog_density } })} />
        <Slider label="Vegetation" min={0} max={1} value={env.vegetation_density} onChange={(vegetation_density) => set({ vegetation_density })} />
      </section>
    </div>
  );
}

function SceneSection() {
  const scene = useStudio((s) => s.scene);
  const applyOps = useStudio((s) => s.applyOps);
  const stats = useMemo(() => sceneStats(scene), [scene]);

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <SectionTitle hint="document">Scene</SectionTitle>
        <Field label="Name">
          <TextInput value={scene.name} readOnly className="text-2xs" />
        </Field>
        <dl className="grid grid-cols-2 gap-1 text-2xs text-neutral-400">
          <div><dt className="inline text-neutral-500">Revision: </dt><dd className="inline font-mono">{scene.revision}</dd></div>
          <div><dt className="inline text-neutral-500">Schema: </dt><dd className="inline font-mono">{scene.schema_version}</dd></div>
          <div><dt className="inline text-neutral-500">Objects: </dt><dd className="inline font-mono">{stats.objects}</dd></div>
          <div><dt className="inline text-neutral-500">Clips: </dt><dd className="inline font-mono">{stats.animations}</dd></div>
          <div><dt className="inline text-neutral-500">Shots: </dt><dd className="inline font-mono">{stats.shots}</dd></div>
          <div><dt className="inline text-neutral-500">Hidden: </dt><dd className="inline font-mono">{stats.hidden}</dd></div>
        </dl>
      </section>
      <section className="space-y-2">
        <SectionTitle hint="render">Output</SectionTitle>
        <Field label="Engine">
          <Select
            value={scene.settings.render_engine}
            options={[{ value: "eevee", label: "EEVEE (preview)" }, { value: "cycles", label: "Cycles (final)" }]}
            onChange={(e) => applyOps([], `Render engine ${e.target.value}`)}
          />
        </Field>
        <p className="text-[10px] leading-relaxed text-neutral-500">
          Resolution {scene.settings.resolution.width}×{scene.settings.resolution.height}, {scene.settings.fps} fps,{" "}
          {scene.settings.duration_frames} frames. Engine and sample changes are applied by the render service, not the viewport.
        </p>
        <Toggle label="Denoise" checked={scene.settings.denoise} onChange={() => applyOps([], "Toggle denoise")} />
        <Toggle label="Motion blur" checked={scene.settings.motion_blur} onChange={() => applyOps([], "Toggle motion blur")} />
      </section>
      <section className="space-y-1">
        <SectionTitle>Shots</SectionTitle>
        <ol className="space-y-1 text-2xs text-neutral-400">
          {scene.shots.map((shot) => (
            <li key={shot.id} className="flex justify-between gap-2">
              <span className="truncate">{shot.index + 1}. {shot.name}</span>
              <span className="font-mono text-neutral-500">{shot.start_frame}–{shot.end_frame}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function Inspector() {
  const scene = useStudio((s) => s.scene);
  const selection = useStudio((s) => s.selection);
  const applyOps = useStudio((s) => s.applyOps);
  const obj = scene.objects.find((o) => o.id === selection[0]) ?? null;

  const index = useMemo(() => {
    const map = new Map<string, string>();
    const walk = (id: string | null, prefix: string) => {
      for (const o of scene.objects.filter((x) => x.parent_id === id)) {
        map.set(o.id, `${prefix}${o.name}`);
        walk(o.id, `${prefix}${o.name} / `);
      }
    };
    walk(null, "");
    return map;
  }, [scene.objects]);

  if (!obj) {
    return (
      <div className="panel-scroll h-full p-3">
        <div className="mb-3 rounded-lg border border-studio-800 bg-studio-850/60 p-2 text-2xs text-neutral-400">
          Nothing selected — showing scene settings. Click any object in the viewport or the hierarchy to edit it.
        </div>
        <SceneSection />
      </div>
    );
  }

  return (
    <div className="panel-scroll h-full p-3">
      <header className="mb-3 space-y-1 border-b border-studio-800 pb-2">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-medium text-neutral-100">{obj.name}</h2>
          <Badge tone="neutral">{obj.type.replace("_", " ")}</Badge>
        </div>
        <p className="truncate text-[10px] text-neutral-500" title={objectPath({ byId: new Map(scene.objects.map((o) => [o.id, o])), children: new Map(), roots: [] }, obj.id)}>
          {index.get(obj.id) ?? obj.name}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" onClick={() => applyOps([{ op: "set_locked", target_id: obj.id, params: { locked: !obj.locked } }], "Toggle lock")} className="rounded border border-studio-700 px-1.5 py-0.5 text-[10px] text-neutral-300 hover:bg-studio-800">
            {obj.locked ? "Unlock" : "Lock"}
          </button>
          <button type="button" onClick={() => applyOps([{ op: "set_visibility", target_id: obj.id, params: { visible: !obj.visible } }], "Toggle visibility")} className="rounded border border-studio-700 px-1.5 py-0.5 text-[10px] text-neutral-300 hover:bg-studio-800">
            {obj.visible ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            onClick={() => {
              const select = useStudio.getState().selectSubtree;
              select(obj.id);
            }}
            className="rounded border border-studio-700 px-1.5 py-0.5 text-[10px] text-neutral-300 hover:bg-studio-800"
          >
            Select subtree
          </button>
          <span className="ml-auto font-mono text-[10px] text-neutral-600">v{obj.version}</span>
        </div>
      </header>

      {obj.type === "character" ? <CharacterSection obj={obj} /> : null}
      {obj.type === "camera" ? <CameraSection obj={obj} /> : null}
      {obj.type === "light" ? <LightSection obj={obj} /> : null}
      {obj.type === "environment" ? <EnvironmentSection /> : null}

      {!["camera", "light", "environment"].includes(obj.type) ? (
        <>
          <TransformSection obj={obj} />
          <div className="my-3 border-t border-studio-800" />
          <MaterialSection obj={obj} />
        </>
      ) : (
        <>
          <div className="my-3 border-t border-studio-800" />
          <TransformSection obj={obj} />
        </>
      )}

      <div className="my-3 border-t border-studio-800" />
      <section className="space-y-1">
        <SectionTitle hint={obj.geometry.kind}>Object</SectionTitle>
        <dl className="grid grid-cols-2 gap-1 text-2xs text-neutral-400">
          <div><dt className="inline text-neutral-500">Parent: </dt><dd className="inline">{scene.objects.find((o) => o.id === obj.parent_id)?.name ?? "root"}</dd></div>
          <div><dt className="inline text-neutral-500">Tags: </dt><dd className="inline">{obj.tags.join(", ") || "—"}</dd></div>
          <div className="col-span-2"><dt className="inline text-neutral-500">Id: </dt><dd className="inline font-mono">{obj.id}</dd></div>
        </dl>
        {obj.geometry.kind === "asset" || obj.geometry.kind === "procedural" ? (
          <p className="rounded border border-amber-400/20 bg-amber-400/5 p-1.5 text-[10px] leading-relaxed text-amber-200">
            This object uses {obj.geometry.kind === "asset" ? "an external asset" : "a procedural generator"}. The viewport shows a
            proxy box; attach the real mesh in Assets to see it.
          </p>
        ) : null}
      </section>
    </div>
  );
}
