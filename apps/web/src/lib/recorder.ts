"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getViewportCanvas } from "./viewport-bridge";

/**
 * Records the live viewport to WebM using MediaRecorder.
 *
 * This is a *viewport preview*: it captures exactly what the browser draws, at
 * screen resolution, with no ray tracing, denoising or motion blur. It is not a
 * Blender render and the UI says so. It exists so "render" produces a real file
 * even when no render worker is connected.
 */

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export interface RecorderState {
  supported: boolean;
  recording: boolean;
  progress: number;
  url: string | null;
  sizeMb: number | null;
  error: string | null;
}

export function useViewportRecorder() {
  const [state, setState] = useState<RecorderState>({
    supported: false,
    recording: false,
    progress: 0,
    url: null,
    sizeMb: null,
    error: null,
  });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<number | null>(null);
  const autoStop = useRef<number | null>(null);

  useEffect(() => {
    setState((s) => ({ ...s, supported: pickMimeType() !== null && typeof HTMLCanvasElement !== "undefined" }));
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      if (autoStop.current) window.clearTimeout(autoStop.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      if (state.url) URL.revokeObjectURL(state.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(() => {
    if (autoStop.current) {
      window.clearTimeout(autoStop.current);
      autoStop.current = null;
    }
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = useCallback(
    (seconds: number, onTick?: (progress: number) => void) => {
      const canvas = getViewportCanvas();
      const mimeType = pickMimeType();
      if (!canvas || !mimeType) {
        setState((s) => ({
          ...s,
          error: canvas ? "This browser cannot record the canvas (MediaRecorder unsupported)." : "Open the studio viewport before recording.",
        }));
        return false;
      }
      if (state.url) URL.revokeObjectURL(state.url);
      chunks.current = [];

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
      recorderRef.current = recorder;
      startedAt.current = performance.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setState((s) => ({
          ...s,
          recording: false,
          progress: 1,
          url,
          sizeMb: Number((blob.size / 1_000_000).toFixed(2)),
          error: null,
        }));
      };

      recorder.start(200);
      setState((s) => ({ ...s, recording: true, progress: 0, url: null, sizeMb: null, error: null }));

      timer.current = window.setInterval(() => {
        const elapsed = (performance.now() - startedAt.current) / 1000;
        const progress = Math.min(1, elapsed / seconds);
        setState((s) => ({ ...s, progress }));
        onTick?.(progress);
      }, 200);

      autoStop.current = window.setTimeout(() => stop(), seconds * 1000);
      return true;
    },
    [state.url, stop],
  );

  return { ...state, start, stop };
}

export function downloadUrl(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
