import { validateEditPlan, type EditPlan, type SceneDocument } from "@ai3d/scene-core";
import { applyEditOperation } from "./operations.js";

export interface PlanApplication {
  ok: boolean;
  scene: SceneDocument;
  touched: string[];
  errors: string[];
  warnings: string[];
  /** Plan-level record written to edit_operations for traceability. */
  audit: {
    plan_id: string;
    prompt: string;
    producer: string;
    operations: number;
    touched: string[];
    applied_at: string;
  };
}

/**
 * Validates then applies a plan atomically: either every operation lands or the
 * scene is returned untouched. Nothing is ever half-applied.
 */
export function applyPlan(scene: SceneDocument, plan: EditPlan): PlanApplication {
  const validation = validateEditPlan(plan, scene);
  if (!validation.ok) {
    return {
      ok: false,
      scene,
      touched: [],
      errors: validation.errors.map((e) => e.message),
      warnings: validation.warnings.map((w) => w.message),
      audit: {
        plan_id: plan.id,
        prompt: plan.prompt,
        producer: plan.producer.kind,
        operations: 0,
        touched: [],
        applied_at: new Date().toISOString(),
      },
    };
  }

  let working = scene;
  const touched: string[] = [];
  try {
    for (const op of plan.operations) {
      const res = applyEditOperation(working, op);
      working = res.scene;
      touched.push(...res.touched);
    }
  } catch (error) {
    return {
      ok: false,
      scene,
      touched: [],
      errors: [error instanceof Error ? error.message : "Unknown apply failure"],
      warnings: validation.warnings.map((w) => w.message),
      audit: {
        plan_id: plan.id,
        prompt: plan.prompt,
        producer: plan.producer.kind,
        operations: 0,
        touched: [],
        applied_at: new Date().toISOString(),
      },
    };
  }

  return {
    ok: true,
    scene: working,
    touched: [...new Set(touched)],
    errors: [],
    warnings: validation.warnings.map((w) => w.message),
    audit: {
      plan_id: plan.id,
      prompt: plan.prompt,
      producer: plan.producer.kind,
      operations: plan.operations.length,
      touched: [...new Set(touched)],
      applied_at: new Date().toISOString(),
    },
  };
}
