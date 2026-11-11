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
