import { beforeEach, describe, expect, it } from "vitest";
import { buildDemoScene, planEdit, validateEditPlan } from "@ai3d/scene-core";
import { useStudio } from "../src/lib/store";

/**
 * Exercises the studio's state machine without a browser: plan → validate →
 * apply → undo, plus selection and lock behaviour. This is the contract the
 * viewport and panels drive.
 */

const reset = () => useStudio.getState().init(buildDemoScene());

describe("studio store", () => {
  beforeEach(reset);

  it("starts from the demo scene with nothing selected", () => {
    const state = useStudio.getState();
    expect(state.scene.objects.length).toBeGreaterThan(20);
    expect(state.selection).toEqual([]);
    expect(state.frame).toBe(0);
  });

  it("selects by id and by subtree", () => {
    useStudio.getState().select("chr_boy");
    expect(useStudio.getState().selection).toEqual(["chr_boy"]);
    useStudio.getState().selectSubtree("chr_boy");
    expect(useStudio.getState().selection).toContain("chr_boy_hair");
    expect(useStudio.getState().selection).not.toContain("obj_apple");
  });

  it("applies a validated plan and bumps the revision", () => {
    const before = useStudio.getState().scene;
    const plan = planEdit("Make the table look like old oak wood.", before);
    expect(validateEditPlan(plan, before).ok).toBe(true);

    useStudio.getState().setPlan(plan, "local");
    expect(useStudio.getState().pendingPlan?.id).toBe(plan.id);
    expect(useStudio.getState().planErrors).toEqual([]);

    const applied = useStudio.getState().applyPendingPlan();
    expect(applied).toBe(true);
    const after = useStudio.getState().scene;
    expect(after.revision).toBe(before.revision + 1);
    expect(after.objects.find((o) => o.id === "obj_table")?.material_overrides?.roughness).toBeCloseTo(0.72);
    expect(useStudio.getState().pendingPlan).toBeNull();
  });

  it("undoes an applied plan exactly", () => {
    const before = JSON.stringify(useStudio.getState().scene);
    const plan = planEdit("Hide the plant.", useStudio.getState().scene);
    useStudio.getState().setPlan(plan, "local");
    useStudio.getState().applyPendingPlan();
    expect(useStudio.getState().scene.objects.find((o) => o.id === "obj_plant")?.visible).toBe(false);

    useStudio.getState().undo();
    expect(JSON.stringify(useStudio.getState().scene)).toBe(before);
  });

  it("rejects a plan that fails validation and keeps the scene", () => {
    const scene = useStudio.getState().scene;
    useStudio.getState().applyOps([{ op: "set_locked", target_id: "obj_apple", params: { locked: true } }], "Lock apple");
    const lockedScene = useStudio.getState().scene;
    const plan = planEdit("Hide the apple.", lockedScene);
    useStudio.getState().setPlan(plan, "local");
    expect(useStudio.getState().planErrors.length).toBeGreaterThan(0);
    expect(useStudio.getState().applyPendingPlan()).toBe(false);
    expect(useStudio.getState().scene.objects.find((o) => o.id === "obj_apple")?.locked).toBe(true);
    expect(scene.objects.find((o) => o.id === "obj_apple")?.locked).toBe(false);
  });

  it("records manual edits in history with a label", () => {
    useStudio.getState().applyOps([{ op: "rename", target_id: "obj_apple", params: { name: "Green apple" } }], "Rename apple");
    const entries = useStudio.getState().historyList();
    expect(entries.at(-1)?.label).toBe("Rename apple");
    expect(useStudio.getState().scene.objects.find((o) => o.id === "obj_apple")?.name).toBe("Green apple");
  });

  it("clamps the playhead to the scene duration", () => {
    useStudio.getState().setFrame(99999);
    expect(useStudio.getState().frame).toBe(useStudio.getState().scene.settings.duration_frames);
    useStudio.getState().setFrame(-5);
    expect(useStudio.getState().frame).toBe(0);
  });

  it("resolves natural-language selection", () => {
    const candidates = useStudio.getState().selectByQuery("the apple");
    expect(useStudio.getState().selection).toContain("obj_apple");
    expect(candidates[0]?.id).toBe("obj_apple");
  });
});

describe("scene lifecycle", () => {
  beforeEach(reset);

  it("builds a new scene from a description instead of reloading the demo", () => {
    const result = useStudio.getState().newScene("prompt", "A girl opens a door in a forest at sunset and reads a letter.");
    expect(result.ok).toBe(true);
    const scene = useStudio.getState().scene;
    expect(scene.objects.some((o) => o.name.toLowerCase().includes("boy"))).toBe(false);
    expect(scene.objects.some((o) => o.id === "chr_lead")).toBe(true);
    expect(scene.environment.time_of_day).toBe("sunset");
    expect(useStudio.getState().sceneSource).toBe("prompt");
    expect(useStudio.getState().selection).toEqual([]);
  });

  it("creates an empty stage with no cast", () => {
    useStudio.getState().newScene("blank");
    const scene = useStudio.getState().scene;
    expect(scene.objects.some((o) => o.type === "character")).toBe(false);
    expect(useStudio.getState().sceneSource).toBe("blank");
  });

  it("refuses a description that is too short", () => {
    const result = useStudio.getState().newScene("prompt", "boy");
    expect(result.ok).toBe(false);
  });

  it("can go back to the demo scene", () => {
    useStudio.getState().newScene("blank");
    useStudio.getState().newScene("demo");
    expect(useStudio.getState().scene.objects.some((o) => o.id === "chr_boy")).toBe(true);
  });

  it("patches render settings and bumps the revision", () => {
    const before = useStudio.getState().scene;
    useStudio.getState().patchSettings({ fps: 30, render_engine: "cycles" }, "Render engine");
    const after = useStudio.getState().scene;
    expect(after.settings.fps).toBe(30);
    expect(after.settings.render_engine).toBe("cycles");
    expect(after.revision).toBe(before.revision + 1);
    useStudio.getState().undo();
    expect(useStudio.getState().scene.settings.fps).toBe(before.settings.fps);
  });

  it("patches the environment without touching objects", () => {
    const before = useStudio.getState().scene;
    useStudio.getState().patchEnvironment({ time_of_day: "night" }, "Time of day");
    const after = useStudio.getState().scene;
    expect(after.environment.time_of_day).toBe("night");
    expect(after.objects.length).toBe(before.objects.length);
  });

  it("adds a keyframe through the inspector path", () => {
    const scene = useStudio.getState().scene;
    const apple = scene.objects.find((o) => o.id === "obj_apple")!;
    const ok = useStudio.getState().applyOps(
      [
        {
          op: "add_animation",
          target_id: apple.id,
          params: {
            clip: {
              name: "Apple bob",
              kind: "transform",
              start_frame: 0,
              end_frame: 48,
              loop: false,
              source: { kind: "manual", model_id: null },
              tracks: [],
            },
          },
        },
      ],
      "New clip",
    );
    expect(ok).toBe(true);
    const clip = useStudio.getState().scene.animations.find((c) => c.name === "Apple bob")!;
    expect(clip).toBeDefined();
    const keyed = useStudio.getState().applyOps(
      [{ op: "add_keyframe", target_id: apple.id, params: { clip_id: clip.id, channel: "transform.position", frame: 24, value: [1, 1.2, -1.4] } }],
      "Keyframe",
    );
    expect(keyed).toBe(true);
    const track = useStudio.getState().scene.animations.find((c) => c.id === clip.id)!.tracks[0]!;
    expect(track.keyframes).toHaveLength(1);
    expect(track.keyframes[0]!.frame).toBe(24);
  });
});
