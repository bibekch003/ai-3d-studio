import { describe, expect, it } from "vitest";
import { buildDemoScene, planEdit, planScene, validateEditPlan } from "../src/index.js";

const scene = buildDemoScene();

describe("edit planner", () => {
  it("maps a material instruction onto the named object", () => {
    const plan = planEdit("Make the table look like old oak wood.", scene);
    const op = plan.operations.find((o) => o.op === "set_material");
    expect(op).toBeDefined();
    expect(op && "target_id" in op ? op.target_id : null).toBe("obj_table");
    expect(plan.producer.kind).toBe("deterministic");
    expect(validateEditPlan(plan, scene).ok).toBe(true);
  });

  it("changes hair while preserving the face", () => {
    const plan = planEdit("Change his hairstyle to a buzz cut but preserve his face.", scene);
    expect(plan.operations.some((o) => o.op === "set_character")).toBe(true);
    expect(plan.preserve.properties).toContain("face");
    const validation = validateEditPlan(plan, scene);
    expect(validation.ok).toBe(true);
    expect(plan.targets.some((t) => t.object_id === "chr_boy")).toBe(true);
  });

  it("drops appearance edits when identity must be preserved", () => {
    const plan = planEdit("Change his hairstyle but preserve his identity.", scene);
    expect(plan.operations.some((o) => o.op === "set_character")).toBe(false);
    expect(plan.warnings.join(" ")).toMatch(/identity/i);
  });

  it("relights the scene for a sunset", () => {
    const plan = planEdit("Change the lighting to a sunset atmosphere.", scene);
    const lightOps = plan.operations.filter((o) => o.op === "set_light");
    expect(lightOps.length).toBe(3);
    const envOp = plan.operations.find((o) => o.op === "set_environment");
    expect(envOp && "params" in envOp ? JSON.stringify(envOp.params) : "").toContain("sunset");
  });

  it("sets a facial expression", () => {
    const plan = planEdit("Make the character smile.", scene);
    const op = plan.operations.find((o) => o.op === "set_character");
    expect(op && "params" in op ? JSON.stringify(op.params) : "").toContain("mouth_smile");
  });

  it("replaces a plant with a palm tree", () => {
    const plan = planEdit("Replace the plant with a palm tree.", scene);
    const ops = plan.operations.map((o) => o.op);
    expect(ops).toContain("replace_geometry");
    expect(ops).toContain("rename");
    const geo = plan.operations.find((o) => o.op === "replace_geometry");
    expect(geo && "params" in geo ? JSON.stringify(geo.params) : "").toContain("prop.palm_tree");
  });

  it("switches the environment to a laboratory", () => {
    const plan = planEdit("Make the room look like a futuristic laboratory.", scene);
    const envOp = plan.operations.find((o) => o.op === "set_environment");
    expect(envOp && "params" in envOp ? JSON.stringify(envOp.params) : "").toContain("room.lab.futuristic");
  });

  it("applies a global style", () => {
    const plan = planEdit("Change the entire scene to a cinematic realistic style.", scene);
    const style = plan.operations.find((o) => o.op === "set_global_style");
    expect(style && "params" in style ? style.params.style : null).toBe("cinematic");
  });

  it("admits when it cannot map an instruction", () => {
    const plan = planEdit("zzzz qqqq", scene);
    expect(plan.operations).toEqual([]);
    expect(plan.confidence).toBeLessThan(0.5);
    expect(plan.requires_confirmation).toBe(true);
    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  it("never produces a plan that fails validation", () => {
    const prompts = [
      "Make the apple glossy red.",
      "Hide the plant.",
      "Animate the boy picking up the apple.",
      "Make it a close-up shot with shallow focus.",
      "Change the room to a beach at sunset.",
    ];
    for (const prompt of prompts) {
      const plan = planEdit(prompt, scene);
      const validation = validateEditPlan(plan, scene);
      expect(validation.errors, `prompt: ${prompt}`).toEqual([]);
    }
  });
});

describe("scene director", () => {
  const prompt = "A boy enters a room, walks towards a wooden table, picks up a red apple and takes a bite.";

  it("casts the character and identifies the prop", () => {
    const plan = planScene(prompt);
    expect(plan.characters[0]?.name).toContain("Boy");
    expect(plan.characters.length).toBe(1);
    expect(plan.props[0]?.name).toBe("Apple");
    expect(plan.environment.kind).toBe("interior");
  });

  it("builds an ordered beat list and a shot per beat", () => {
    const plan = planScene(prompt);
    expect(plan.beats).toContain("enters");
    expect(plan.beats.some((b) => b.startsWith("picks up"))).toBe(true);
    expect(plan.shots[0]?.name).toBe("Establishing");
    expect(plan.shots.length).toBe(plan.beats.length + 1);
    for (let i = 1; i < plan.shots.length; i += 1) {
      expect(plan.shots[i]!.start_frame).toBe(plan.shots[i - 1]!.end_frame);
    }
  });

  it("emits only validated scene operations, never code", () => {
    const plan = planScene(prompt);
    const ops = plan.operations.map((o) => o.op);
    expect(ops).toContain("set_environment");
    expect(ops).toContain("set_shot");
    expect(ops.every((o) => typeof o === "string")).toBe(true);
    expect(JSON.stringify(plan.operations)).not.toMatch(/exec|eval|import\(/);
  });

  it("warns instead of inventing a character when none is named", () => {
    const plan = planScene("A camera slowly pushes through an empty corridor.");
    expect(plan.warnings.join(" ")).toMatch(/No character was named/);
  });
});
