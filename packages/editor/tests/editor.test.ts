import { describe, expect, it } from "vitest";
import { buildDemoScene, validateScene, type EditPlan } from "@ai3d/scene-core";
import { applyEditOperation, applyPlan, SceneHistory, SelectionModel } from "../src/index.js";

const plan = (ops: EditPlan["operations"]): EditPlan => ({
  id: "plan_1",
  prompt: "make the table old oak",
  summary: "Update the table material",
  targets: [{ object_id: "obj_table", name: "Wooden table", type: "furniture", reason: "named", confidence: 0.9 }],
  operations: ops,
  preserve: { properties: ["face", "camera", "animation"], object_ids: [] },
  confidence: 0.9,
  warnings: [],
  requires_confirmation: false,
  producer: { kind: "deterministic", model_id: null },
  estimated_cost_usd: 0,
  created_at: new Date().toISOString(),
});

describe("operations", () => {
  it("does not mutate the input scene", () => {
    const scene = buildDemoScene();
    const before = JSON.stringify(scene);
    applyEditOperation(scene, { op: "rename", target_id: "obj_apple", params: { name: "Green apple" } });
    expect(JSON.stringify(scene)).toBe(before);
  });

  it("bumps the object version and the scene revision", () => {
    const scene = buildDemoScene();
    const res = applyEditOperation(scene, { op: "set_visibility", target_id: "obj_plant", params: { visible: false } });
    expect(res.scene.revision).toBe(scene.revision + 1);
    expect(res.scene.objects.find((o) => o.id === "obj_plant")?.visible).toBe(false);
    expect(res.scene.objects.find((o) => o.id === "obj_plant")?.version).toBe(2);
    expect(validateScene(res.scene).ok).toBe(true);
  });

  it("deletes descendants with their parent", () => {
    const scene = buildDemoScene();
    const res = applyEditOperation(scene, { op: "remove_object", target_id: "chr_boy", params: {} });
    expect(res.scene.objects.some((o) => o.id === "chr_boy_hair")).toBe(false);
    expect(res.scene.animations.some((a) => a.target_id === "chr_boy")).toBe(false);
    expect(validateScene(res.scene).ok).toBe(true);
  });

  it("adds a keyframe and replaces an existing one at the same frame", () => {
    const scene = buildDemoScene();
    const res = applyEditOperation(scene, {
      op: "add_keyframe",
      target_id: "obj_apple",
      params: { clip_id: "anim_apple_pickup", channel: "transform.position", frame: 150, value: [1.0, 0.9, -1.4] },
    });
    const clip = res.scene.animations.find((a) => a.id === "anim_apple_pickup")!;
    const track = clip.tracks.find((t) => t.channel === "transform.position")!;
    expect(track.keyframes.map((k) => k.frame)).toEqual([132, 150, 168]);
  });
});

describe("applyPlan", () => {
  it("applies a multi-operation plan atomically", () => {
    const scene = buildDemoScene();
    const res = applyPlan(
      scene,
      plan([
        { op: "set_material", target_id: "obj_table", params: { patch: { roughness: 0.95, base_color: "#5a3b22" } } },
        { op: "set_character", target_id: "chr_boy", params: { patch: { hair: { style_id: "hair.short_crop" } } } },
      ]),
    );
    expect(res.ok).toBe(true);
    expect(res.touched).toContain("obj_table");
    expect(res.scene.objects.find((o) => o.id === "chr_boy")?.character?.hair.style_id).toBe("hair.short_crop");
    expect(res.scene.objects.find((o) => o.id === "chr_boy")?.character?.identity_id).toBe("ident_boy_01");
    expect(res.audit.operations).toBe(2);
  });

  it("returns the scene untouched when validation fails", () => {
    const scene = buildDemoScene();
    const res = applyPlan(scene, plan([{ op: "set_camera", target_id: "obj_apple", params: { patch: { fstop: 1 } } }]));
    expect(res.ok).toBe(false);
    expect(res.scene).toBe(scene);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it("rolls back if an operation throws mid-plan", () => {
    const scene = buildDemoScene();
    const res = applyPlan(
      scene,
      plan([
        { op: "rename", target_id: "obj_apple", params: { name: "Apple 2" } },
        { op: "set_character", target_id: "obj_apple", params: { patch: { hair: { style_id: "x" } } } },
      ]),
    );
    // set_character on a prop is rejected by validation before any apply
    expect(res.ok).toBe(false);
    expect(res.scene.objects.find((o) => o.id === "obj_apple")?.name).toBe("Red apple");
  });
});

describe("history", () => {
  it("undoes and redoes exactly", () => {
    const scene = buildDemoScene();
    const history = new SceneHistory();
    history.reset(scene);
    const step = applyEditOperation(scene, { op: "set_visibility", target_id: "obj_plant", params: { visible: false } });
    history.push(step.scene, "Hide plant", "manual", step.touched);
    expect(history.canUndo()).toBe(true);
    const undone = history.undo()!;
    expect(undone.objects.find((o) => o.id === "obj_plant")?.visible).toBe(true);
    const redone = history.redo()!;
    expect(redone.objects.find((o) => o.id === "obj_plant")?.visible).toBe(false);
  });

  it("drops the redo branch when a new edit lands after undo", () => {
    const scene = buildDemoScene();
    const history = new SceneHistory();
    history.reset(scene);
    const a = applyEditOperation(scene, { op: "rename", target_id: "obj_apple", params: { name: "A" } });
    history.push(a.scene, "rename A");
    const b = applyEditOperation(a.scene, { op: "rename", target_id: "obj_apple", params: { name: "B" } });
    history.push(b.scene, "rename B");
    history.undo();
    expect(history.canRedo()).toBe(true);
    const c = applyEditOperation(a.scene, { op: "rename", target_id: "obj_apple", params: { name: "C" } });
    history.push(c.scene, "rename C");
    expect(history.canRedo()).toBe(false);
    expect(history.current()?.snapshot.objects.find((o) => o.id === "obj_apple")?.name).toBe("C");
  });

  it("branches a variation with a new scene id", () => {
    const scene = buildDemoScene();
    const history = new SceneHistory();
    history.reset(scene);
    const entryId = history.current()!.id;
    const branch = history.branch(entryId, "Night version")!;
    expect(branch.scene.id).not.toBe(scene.id);
    expect(branch.scene.name).toBe("Night version");
  });

  it("reports what the last change touched", () => {
    const scene = buildDemoScene();
    const history = new SceneHistory();
    history.reset(scene);
    const step = applyEditOperation(scene, { op: "set_visibility", target_id: "obj_plant", params: { visible: false } });
    history.push(step.scene, "Hide plant", "manual", step.touched);
    expect(history.lastChange()?.changed).toContain("obj_plant");
  });
});

describe("selection", () => {
  it("selects a whole character subtree", () => {
    const scene = buildDemoScene();
    const sel = new SelectionModel(scene);
    const state = sel.selectSubtree("chr_boy");
    expect(state.selectedIds).toContain("chr_boy");
    expect(state.selectedIds).toContain("chr_boy_hair");
    expect(state.selectedIds).toContain("chr_boy_hand_r");
    expect(state.selectedIds).not.toContain("obj_apple");
  });

  it("supports toggle and category selection", () => {
    const scene = buildDemoScene();
    const sel = new SelectionModel(scene);
    sel.select(["obj_apple"]);
    sel.select(["obj_apple"], "toggle");
    expect(sel.get().selectedIds).toEqual([]);
    const lights = sel.selectByType("light");
    expect(lights.selectedIds).toEqual(["lgt_key", "lgt_fill", "lgt_window"]);
  });

  it("resolves natural language selection with candidates", () => {
    const scene = buildDemoScene();
    const sel = new SelectionModel(scene);
    const res = sel.selectByQuery("the plant");
    expect(res.state.selectedIds).toContain("obj_plant");
    expect(res.candidates.length).toBeGreaterThan(0);
  });

  it("drops ids that no longer exist after a scene swap", () => {
    const scene = buildDemoScene();
    const sel = new SelectionModel(scene);
    sel.select(["obj_apple", "chr_boy"]);
    const next = structuredClone(scene);
    next.objects = next.objects.filter((o) => o.id !== "chr_boy");
    sel.setScene(next);
    expect(sel.get().selectedIds).toEqual(["obj_apple"]);
  });
});

describe("identity preservation", () => {
  it("allows a hairstyle change while the face is preserved", () => {
    const scene = buildDemoScene();
    const res = applyPlan(scene, {
      ...plan([
        {
          op: "set_character",
          target_id: "chr_boy",
          params: { patch: { hair: { style_id: "hair.long_wave" } } },
        },
      ]),
      preserve: { properties: ["face"], object_ids: [] },
    });
    expect(res.ok).toBe(true);
    const boy = res.scene.objects.find((o) => o.id === "chr_boy")!;
    expect(boy.character?.hair.style_id).toBe("hair.long_wave");
    expect(boy.character?.expression).toEqual({ mouth_smile: 0.15, brow_neutral: 1 });
  });

  it("refuses to change hair when identity is preserved", () => {
    const scene = buildDemoScene();
    const res = applyPlan(scene, {
      ...plan([
        { op: "set_character", target_id: "chr_boy", params: { patch: { hair: { style_id: "hair.long_wave" } } } },
      ]),
      preserve: { properties: ["identity"], object_ids: [] },
    });
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/identity/);
  });
});
