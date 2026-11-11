"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@ai3d/ui";
import { useStudio } from "@/lib/store";

const ROW_H = 22;
const LABEL_W = "9rem";

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
      const current = useStudio.getState().frame;
      const next = current + dt * fps;
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
    // Only these two slices matter; `scene` changes identity on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.animations, scene.objects]);

  const pct = (f: number) => `${(Math.max(0, Math.min(duration, f)) / duration) * 100}%`;
  const scrubTo = (event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setFrame(((event.clientX - rect.left) / rect.width) * duration);
  };

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
        <button type="button" onClick={() => setFrame(0)} className="rounded border border-studio-700 px-1.5 py-0.5 text-2xs text-neutral-300 hover:bg-studio-800" aria-label="Go to start">
          ⏮
        </button>
        <span className="font-mono text-2xs text-neutral-300">
          {String(Math.round(frame)).padStart(4, "0")} / {duration} · {(frame / fps).toFixed(2)}s
        </span>
        <span className="ml-auto font-mono text-2xs text-neutral-500">
          {fps} fps · {scene.shots.length} shots · {scene.animations.length} clips
        </span>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {/* ruler */}
        <div className="absolute inset-x-0 top-0 h-5 border-b border-studio-800 bg-studio-950/60">
          <div className="absolute inset-y-0 left-0 w-36 border-r border-studio-800" />
          <div
            className="absolute inset-y-0 left-36 right-0 cursor-pointer"
            onClick={scrubTo}
            role="slider"
            aria-label="Timeline scrubber"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={Math.round(frame)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setFrame(frame + 1);
              if (e.key === "ArrowLeft") setFrame(frame - 1);
            }}
          >
            {Array.from({ length: Math.floor(duration / fps) + 1 }).map((_, i) => (
              <span key={i} className="absolute top-0 h-full border-l border-studio-800 text-[9px] text-neutral-600" style={{ left: pct(i * fps) }}>
                {i > 0 ? <span className="ml-0.5">{i}s</span> : null}
              </span>
            ))}
            {scene.shots.map((shot) => (
              <button
                key={shot.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFrame(shot.start_frame);
                  if (shot.camera_id) select(shot.camera_id);
                }}
                className="absolute top-0 h-full border-x border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20"
                style={{ left: pct(shot.start_frame), width: pct(shot.end_frame - shot.start_frame) }}
                title={`${shot.name} (${shot.start_frame}–${shot.end_frame}): ${shot.description}`}
              />
            ))}
          </div>
        </div>

        {/* tracks */}
        <div className="panel-scroll absolute inset-x-0 bottom-0 top-5">
          {tracks.map((track) => (
            <div key={track.targetId} className="flex items-center border-b border-studio-800/60" style={{ height: ROW_H }}>
              <button
                type="button"
                onClick={() => select(track.targetId)}
                className="shrink-0 truncate border-r border-studio-800 px-2 text-left font-mono text-[10px] text-neutral-400 hover:text-neutral-100"
                style={{ width: LABEL_W }}
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
                    title={`${clip.name} (${clip.kind}) — ${clip.tracks.flatMap((t) => t.keyframes).length} keys`}
                  >
                    {clip.tracks.flatMap((t) => t.keyframes).map((kf) => (
                      <button
                        key={kf.id}
                        type="button"
                        aria-label={`Keyframe at frame ${kf.frame}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFrame(kf.frame);
                        }}
                        className="absolute top-0 h-full w-px bg-neutral-200/70 hover:w-1 hover:bg-amber-300"
                        style={{ left: `${((kf.frame - clip.start_frame) / Math.max(1, clip.end_frame - clip.start_frame)) * 100}%` }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {tracks.length === 0 ? (
            <p className="p-3 text-2xs text-neutral-500">
              No animation clips yet. Use <span className="text-neutral-300">AI edit → New scene</span> to build an animated
              scene, or add a clip from the inspector.
            </p>
          ) : null}
        </div>

        {/* playhead */}
        <div className="pointer-events-none absolute bottom-0 left-36 right-0 top-5">
          <div className="absolute inset-y-0 w-px bg-amber-400" style={{ left: pct(frame) }} />
        </div>
      </div>
    </div>
  );
}
