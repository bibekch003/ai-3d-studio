import { describe, expect, it } from "vitest";
import {
  buildDemoScene,
  emptyScene,
  flattenTree,
  indexScene,
  migrateScene,
  objectPath,
  searchObjects,
  validateScene,
  validateEditPlan,
  type EditPlan,
} from "../src/index.js";

const plan = (over: Partial<EditPlan>): EditPlan => ({
  id: "plan_test",
  prompt: "test",
  summary: "test plan",
  targets: [],
  operations: [],
  preserve: { properties: [], object_ids: [] },
  confidence: 0.9,
  warnings: [],
  requires_confirmation: false,
  producer: { kind: "deterministic", model_id: null },
  estimated_cost_usd: 0,
  created_at: new Date().toISOString(),
  ...over,
});

describe("scene document", () => {
  it("accepts the demo scene", () => {
    const result = validateScene(buildDemoScene());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.data?.objects.length).toBeGreaterThan(20);
  });

  it("rejects duplicate object ids", () => {
    const scene = buildDemoScene();
    scene.objects.push({ ...scene.objects[0]! });
    const result = validateScene(scene);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "graph.duplicate_id")).toBe(true);
  });

  it("rejects hierarchy cycles", () => {
    const scene = buildDemoScene();
    const room = scene.objects.find((o) => o.id === "env_room")!;
    const floor = scene.objects.find((o) => o.id === "obj_floor")!;
    room.parent_id = floor.id;
    const result = validateScene(scene);
    expect(result.errors.some((e) => e.code === "graph.cycle")).toBe(true);
  });

  it("rejects an invalid hex colour", () => {
    const scene = buildDemoScene();
    scene.materials[0]!.base_color = "brown";
    expect(validateScene(scene).ok).toBe(false);
  });

  it("resolves natural language references to object ids", () => {
    const scene = buildDemoScene();
    expect(searchObjects(scene, "apple")[0]?.object.id).toBe("obj_apple");
    expect(searchObjects(scene, "hair")[0]?.object.id).toBe("chr_boy_hair");
    expect(searchObjects(scene, "table")[0]?.object.id).toBe("obj_table");
    expect(searchObjects(scene, "nonsense-xyz")).toEqual([]);
  });

  it("builds readable hierarchy paths", () => {
    const scene = buildDemoScene();
    expect(objectPath(indexScene(scene), "chr_boy_hair")).toBe("Character_Boy / Head / Hair");
  });

  it("flattens the tree parents-first", () => {
    const scene = buildDemoScene();
    const flat = flattenTree(indexScene(scene));
    const boyIdx = flat.findIndex((f) => f.object.id === "chr_boy");
    const hairIdx = flat.findIndex((f) => f.object.id === "chr_boy_hair");
    expect(boyIdx).toBeGreaterThanOrEqual(0);
    expect(hairIdx).toBeGreaterThan(boyIdx);
    expect(flat.find((f) => f.object.id === "chr_boy_hair")?.depth).toBe(2);
  });
});

describe("migrations", () => {
  it("upgrades a 1.0 document to the current schema", () => {
    const legacy = buildDemoScene() as unknown as Record<string, unknown>;
    delete legacy.schema_version;
    delete legacy.shots;
    delete legacy.materials;
    for (const obj of legacy.objects as Record<string, unknown>[]) {
      delete obj.protected;
      delete obj.version;
    }
    const result = migrateScene({ ...legacy, schema_version: "1.0" });
    expect(result.applied).toEqual(["1.0->1.1"]);
    expect(result.document.schema_version).toBe("1.1");
    expect(result.document.objects.every((o) => o.protected === false)).toBe(true);
    expect(validateScene(result.document).ok).toBe(true);
  });

  it("refuses a document from the future", () => {
    expect(() => migrateScene({ ...emptyScene({}), schema_version: "9.0" })).toThrow(/newer than this build/);
  });

  it("refuses a document older than the supported floor", () => {
    expect(() => migrateScene({ ...emptyScene({}), schema_version: "0.4" })).toThrow(/older than the supported minimum/);
  });
});

describe("edit plan validation", () => {
  it("accepts a valid material edit", () => {
    const scene = buildDemoScene();
    const result = validateEditPlan(
      plan({
        operations: [{ op: "set_material", target_id: "obj_table", params: { patch: { roughness: 0.9 } } }],
      }),
      scene,
    );
    expect(result.ok).toBe(true);
    expect(result.affected[0]?.name).toBe("Wooden table");
  });

  it("rejects an unknown target", () => {
    const scene = buildDemoScene();
    const result = validateEditPlan(
      plan({ operations: [{ op: "set_visibility", target_id: "obj_ghost", params: { visible: false } }] }),
      scene,
    );
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("plan.target_missing");
  });

  it("rejects camera edits on a prop", () => {
    const scene = buildDemoScene();
    const result = validateEditPlan(
      plan({ operations: [{ op: "set_camera", target_id: "obj_apple", params: { patch: { fstop: 2 } } }] }),
      scene,
    );
    expect(result.errors.some((e) => e.code === "plan.target_type_mismatch")).toBe(true);
  });

  it("blocks edits to locked objects", () => {
    const scene = buildDemoScene();
    scene.objects.find((o) => o.id === "obj_apple")!.locked = true;
    const result = validateEditPlan(
      plan({ operations: [{ op: "set_transform", target_id: "obj_apple", params: { position: [0, 1, 0] } }] }),
      scene,
    );
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("plan.target_locked");
  });

  it("warns about protected objects", () => {
    const scene = buildDemoScene();
    scene.objects.find((o) => o.id === "chr_boy")!.protected = true;
    const result = validateEditPlan(
      plan({ operations: [{ op: "set_character", target_id: "chr_boy", params: { patch: { hair: { style_id: "hair.buzz" } } } }] }),
      scene,
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.code === "plan.target_protected")).toBe(true);
  });

  it("catches preservation conflicts", () => {
    const scene = buildDemoScene();
    const result = validateEditPlan(
      plan({
        preserve: { properties: ["materials"], object_ids: [] },
        operations: [{ op: "set_material", target_id: "obj_table", params: { patch: { metallic: 1 } } }],
      }),
      scene,
    );
    expect(result.errors.some((e) => e.code === "plan.preservation_conflict")).toBe(true);
  });

  it("rejects AI creation of cameras", () => {
    const scene = buildDemoScene();
    const result = validateEditPlan(
      plan({
        operations: [
          { op: "add_object", target_id: null, params: { object: { name: "Sneaky cam", type: "camera" }, parent_id: null } },
        ],
      }),
      scene,
    );
    expect(result.errors.some((e) => e.code === "plan.add_object_type_blocked")).toBe(true);
  });
});
