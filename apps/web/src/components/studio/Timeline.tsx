"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@ai3d/ui";
import { useStudio } from "@/lib/store";

const ROW_H = 22;

export function Timeline() {
  const scene = useStudio((s) => s.scene);
  const frame = useStudio((s) => s.frame);
  const playing = useStudio((s) => s.playing);
  const setFrame = useStudio((s) => s.setFrame);
  const setPlaying = useStudio((s) => s.setPlaying);
  const select = useStudio((s) => s.select);

  const duration = scene.settings.duration_frames;
  const fps = scene.settings.fps;
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  useEffect(() => {
    if (!playing) {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
      return;
    }
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      const next = frame + dt * fps;
      if (next >= duration) {
        setFrame(duration);
        setPlaying(false);
        return;
      }
      setFrame(next);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // frame is intentionally not a dependency: the loop reads the store directly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, fps, duration, setFrame, setPlaying]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying(!playing);
      }
      if (e.code === "ArrowRight") setFrame(frame + 1);
      if (e.code === "ArrowLeft") setFrame(frame - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frame, playing, setFrame, setPlaying]);

  const tracks = useMemo(() => {
    const byTarget = new Map<string, typeof scene.animations>();
    for (const clip of scene.animations) {
      const list = byTarget.get(clip.target_id) ?? [];
      list.push(clip);
      byTarget.set(clip.target_id, list);
    }
    return [...byTarget.entries()].map(([targetId, clips]) => ({
      targetId,
      name: scene.objects.find((o) => o.id === targetId)?.name ?? targetId,
      clips,
    }));
    // Depend on the two slices we read; `scene` itself changes identity on every
    // edit and would rebuild the track list for unrelated changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.animations, scene.objects]);

  const pct = (f: number) => `${(f / duration) * 100}%`;

  return (
    <div className="flex h-full flex-col bg-studio-900/70">
      <div className="flex items-center gap-2 border-b border-studio-800 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          className="grid size-6 place-items-center rounded bg-amber-400 text-2xs font-bold text-neutral-950 hover:bg-amber-300"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button type="button" onClick={() => setFrame(0)} className="rounded border border-studio-700 px-1.5 py-0.5 text-2xs text-neutral-300 hover:bg-studio-800">
          ⏮
        </button>
        <span className="font-mono text-2xs text-neutral-300">
          {String(Math.round(frame)).padStart(4, "0")} / {duration} · {(frame / fps).toFixed(2)}s
        </span>
        <span className="ml-auto font-mono text-2xs text-neutral-500">{fps} fps · {scene.shots.length} shots</span>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-5 border-b border-studio-800 bg-studio-950/60">
          <div
            className="relative h-full cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setFrame(((e.clientX - rect.left) / rect.width) * duration);
            }}
            role="slider"
            aria-label="Timeline scrubber"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={Math.round(frame)}
            tabIndex={0}
          >
            {Array.from({ length: Math.floor(duration / fps) + 1 }).map((_, i) => (
              <span
                key={i}
                className="absolute top-0 h-full border-l border-studio-800 text-[9px] text-neutral-600"
                style={{ left: pct(i * fps) }}
              >
                {i > 0 ? <span className="ml-0.5">{i}s</span> : null}
              </span>
            ))}
            {scene.shots.map((shot) => (
              <span
                key={shot.id}
                className="absolute top-0 h-full border-x border-amber-400/30 bg-amber-400/5"
                style={{ left: pct(shot.start_frame), width: pct(shot.end_frame - shot.start_frame) }}
                title={`${shot.name}: ${shot.description}`}
              />
            ))}
          </div>
        </div>

        <div className="panel-scroll absolute inset-x-0 bottom-0 top-5">
          {tracks.map((track) => (
            <div key={track.targetId} className="flex items-center border-b border-studio-800/60" style={{ height: ROW_H }}>
              <button
                type="button"
                onClick={() => select(track.targetId)}
                className="w-36 shrink-0 truncate border-r border-studio-800 px-2 text-left font-mono text-[10px] text-neutral-400 hover:text-neutral-100"
                title={track.name}
              >
                {track.name}
              </button>
              <div className="relative h-full flex-1">
                {track.clips.map((clip) => (
                  <div
                    key={clip.id}
                    className={cn(
                      "absolute top-1 h-3.5 rounded-sm border",
                      clip.kind === "transform" ? "border-sky-400/40 bg-sky-400/20" : "border-violet-400/40 bg-violet-400/20",
                    )}
                    style={{ left: pct(clip.start_frame), width: pct(clip.end_frame - clip.start_frame) }}
                    title={`${clip.name} (${clip.kind})`}
                  >
                    {clip.tracks.flatMap((t) => t.keyframes).map((kf) => (
                      <span
                        key={kf.id}
                        className="absolute top-0 h-full w-px bg-neutral-200/70"
                        style={{ left: `${((kf.frame - clip.start_frame) / Math.max(1, clip.end_frame - clip.start_frame)) * 100}%` }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {tracks.length === 0 ? (
            <p className="p-3 text-2xs text-neutral-500">No animation clips yet. Ask the AI panel to animate an object.</p>
          ) : null}
        </div>

        <div className="pointer-events-none absolute inset-y-0 w-px bg-amber-400" style={{ left: `calc(9rem + ${pct(frame)} * (100% - 9rem) / 100%)` }} />
      </div>
    </div>
  );
}
