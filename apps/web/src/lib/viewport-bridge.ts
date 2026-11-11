/**
 * The 3D canvas is created inside React Three Fiber, but recording and stills
 * are triggered from the toolbar. This tiny registry is the hand-off point:
 * the viewport registers its canvas, the recorder reads it.
 */
let canvas: HTMLCanvasElement | null = null;

export function setViewportCanvas(next: HTMLCanvasElement | null): void {
  canvas = next;
}

export function getViewportCanvas(): HTMLCanvasElement | null {
  return canvas;
}

export function captureStill(): string | null {
  if (!canvas) return null;
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
