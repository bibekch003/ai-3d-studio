import { describe, expect, it } from "vitest";
import { buildDemoScene, sampleKeyframes, sampleScene } from "../src/index.js";

describe("keyframe sampling", () => {
  const keys = [
    { id: "a", frame: 0, value: [0, 0, 0] as [number, number, number], interpolation: "linear" as const },
    { id: "b", frame: 100, value: [10, 0, 0] as [number, number, number], interpolation: "linear" as const },
  ];

  it("returns the endpoints outside the range", () => {
    expect(sampleKeyframes(keys, -5)).toEqual([0, 0, 0]);
    expect(sampleKeyframes(keys, 500)).toEqual([10, 0, 0]);
  });

  it("interpolates linearly in the middle", () => {
    expect(sampleKeyframes(keys, 50)).toEqual([5, 0, 0]);
  });

  it("honours step interpolation", () => {
    // Interpolation belongs to the keyframe that starts the segment.
    const step = [{ ...keys[0]!, interpolation: "step" as const }, keys[1]!];
    expect(sampleKeyframes(step, 99)).toEqual([0, 0, 0]);
    expect(sampleKeyframes(step, 100)).toEqual([10, 0, 0]);
  });

  it("eases bezier interpolation instead of running flat", () => {
    const bezier = [{ ...keys[0]!, interpolation: "bezier" as const }, keys[1]!];
    const mid = sampleKeyframes(bezier, 50) as number[];
    expect(mid[0]).toBeCloseTo(5, 1);
    const quarter = sampleKeyframes(bezier, 25) as number[];
    expect(quarter[0]!).toBeLessThan(2.5); // slower at the start
  });
});

describe("scene sampling", () => {
  const scene = buildDemoScene();

  it("moves the character between frames", () => {
    const start = sampleScene(scene, 0).transforms.get("chr_boy");
    const mid = sampleScene(scene, 48).transforms.get("chr_boy");
    const end = sampleScene(scene, 96).transforms.get("chr_boy");
    expect(start?.position?.[0]).toBeCloseTo(-2.4, 2);
    expect(mid?.position?.[0]).toBeGreaterThan(-2.4);
    expect(end?.position?.[0]).toBeCloseTo(0.45, 2);
  });

  it("ignores clips outside their frame range", () => {
    // The apple pickup clip runs 132-168; at frame 0 the apple must not move.
    expect(sampleScene(scene, 0).transforms.get("obj_apple")).toBeUndefined();
    expect(sampleScene(scene, 150).transforms.get("obj_apple")).toBeDefined();
  });

  it("returns no transforms for an unanimated frame range", () => {
    const result = sampleScene({ ...scene, animations: [] }, 42);
    expect(result.transforms.size).toBe(0);
  });

  it("loops clips when asked", () => {
    const looping = {
      ...scene,
      animations: [
        {
          ...scene.animations[0]!,
          loop: true,
          start_frame: 0,
          end_frame: 24,
        },
      ],
    };
    const a = sampleScene(looping, 0).transforms.get("chr_boy");
    const b = sampleScene(looping, 24).transforms.get("chr_boy");
    const c = sampleScene(looping, 48).transforms.get("chr_boy");
    expect(a?.position).toEqual(b?.position);
    expect(c?.position).toEqual(a?.position);
  });
});
