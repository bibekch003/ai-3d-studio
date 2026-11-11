import { describe, expect, it } from "vitest";
import {
  buildBlankScene,
  buildSceneFromPrompt,
  sampleScene,
  sceneStats,
  validateScene,
} from "../src/index.js";

describe("scene builder", () => {
  it("builds a valid, editable scene for a written description", () => {
    const { scene, warnings } = buildSceneFromPrompt("A boy enters a room, walks to a table, picks up an apple and takes a bite.");
    const validation = validateScene(scene);
    expect(validation.errors).toEqual([]);
    expect(validation.ok).toBe(true);
    expect(warnings.filter((w) => w.startsWith("Scene validation"))).toEqual([]);
  });

  it("does not fall back to the demo scene", () => {
    const { scene } = buildSceneFromPrompt("A robot sits in a laboratory at night and reads a book.");
    const names = scene.objects.map((o) => o.name.toLowerCase());
    expect(names).not.toContain("character_boy");
    expect(names.some((n) => n.includes("robot"))).toBe(true);
    expect(names.some((n) => n.includes("book"))).toBe(true);
    expect(scene.environment.time_of_day).toBe("night");
    expect(scene.environment.preset_id).toBe("room.lab.futuristic");
  });

  it("is deterministic for the same prompt", () => {
    const a = buildSceneFromPrompt("A girl opens a door in a forest at sunset.");
    const b = buildSceneFromPrompt("A girl opens a door in a forest at sunset.");
    expect(a.scene.objects.map((o) => o.id)).toEqual(b.scene.objects.map((o) => o.id));
  });

  it("creates the character hierarchy the inspector expects", () => {
    const { scene } = buildSceneFromPrompt("A man walks into an office and sits on a chair.");
    const ids = scene.objects.map((o) => o.id);
    expect(ids).toContain("chr_lead");
    expect(ids).toContain("chr_lead_head");
    expect(ids).toContain("chr_lead_hair");
    expect(ids).toContain("chr_lead_hand_r");
    const lead = scene.objects.find((o) => o.id === "chr_lead")!;
    expect(lead.character?.identity_id).toContain("ident_");
    expect(lead.character?.identity_locked.length).toBeGreaterThan(0);
  });

  it("animates the entrance and the interaction", () => {
    const { scene } = buildSceneFromPrompt("A boy enters a room, picks up an apple and takes a bite.");
    expect(scene.animations.length).toBeGreaterThanOrEqual(2);
    const start = sampleScene(scene, 0).transforms.get("chr_lead");
    const later = sampleScene(scene, Math.round(scene.settings.duration_frames * 0.4)).transforms.get("chr_lead");
    expect(start?.position?.[0]).toBeLessThan(0);
    expect(later?.position?.[0]).toBeGreaterThan(start!.position![0]);
  });

  it("produces a shot list that covers the scene", () => {
    const { scene } = buildSceneFromPrompt("A detective opens a door in a street at night and looks at a letter.");
    expect(scene.shots.length).toBeGreaterThan(1);
    expect(scene.shots[0]!.start_frame).toBe(0);
    expect(scene.shots[0]!.camera_id).toBe("cam_main");
    expect(scene.active_camera_id).toBe("cam_main");
    expect(sceneStats(scene).objects).toBeGreaterThan(12);
  });

  it("builds an empty stage with no cast", () => {
    const scene = buildBlankScene();
    expect(validateScene(scene).ok).toBe(true);
    expect(scene.objects.some((o) => o.type === "character")).toBe(false);
    expect(scene.objects.filter((o) => o.type === "light").length).toBe(2);
    expect(scene.animations).toEqual([]);
  });
});
