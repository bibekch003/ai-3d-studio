/**
 * API contract types shared by the web app and the services.
 * Keep in sync with services/api/app/schemas/*.py (openapi.json is the source).
 */
import type { EditPlan, SceneDocument, SceneObject, ValidationIssue } from "@ai3d/scene-core";

export type { ScenePlan as DirectorPlan, PlanShot as DirectorShot } from "@ai3d/scene-core";

export type { EditPlan, SceneDocument, SceneObject, ValidationIssue };

export type UserRole = "owner" | "editor" | "viewer";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  workspace_mode: "beginner" | "professional";
  created_at: string;
}

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  cover_asset_id: string | null;
  fps: number;
  default_resolution: string;
  created_at: string;
  updated_at: string;
  scene_count?: number;
  role?: UserRole;
}

export interface ProjectSummary extends Project {
  last_scene_id: string | null;
  last_opened_at: string | null;
}

export interface SceneRecord {
  id: string;
  project_id: string;
  name: string;
  revision: number;
  updated_at: string;
  thumbnail_url: string | null;
}

export interface SceneResponse {
  scene: SceneDocument;
  history?: { id: string; label: string; kind: string; created_at: string }[];
}

export interface AssetRecord {
  id: string;
  project_id: string | null;
  owner_id: string;
  kind: "model" | "texture" | "hdri" | "audio" | "video" | "image";
  name: string;
  format: string;
  size_bytes: number;
  storage_path: string;
  preview_url: string | null;
  licence: string;
  source: "upload" | "library" | "generated";
  created_at: string;
}

export interface PlanResponse {
  plan: EditPlan;
  validation: { ok: boolean; errors: ValidationIssue[]; warnings: ValidationIssue[] };
  affected: { object_id: string; name: string; type: string; changes: string[] }[];
}

export interface ApplyResponse {
  scene: SceneDocument;
  touched: string[];
  audit: { plan_id: string; operations: number; applied_at: string };
  warnings: string[];
}

export interface JobRecord {
  id: string;
  project_id: string;
  scene_id: string | null;
  kind: "generation" | "render" | "segmentation" | "export";
  status: JobStatus;
  progress: number;
  message: string;
  output_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface RenderRequest {
  scene_id: string;
  engine: "eevee" | "cycles";
  resolution: "1920x1080" | "2560x1440" | "3840x2160";
  fps: 24 | 25 | 30 | 60;
  samples: number;
  frame_range: [number, number];
  format: "mp4" | "png_sequence" | "exr_sequence" | "blend";
}

export interface ModelRecord {
  id: string;
  name: string;
  family: string;
  task: string;
  version: string;
  licence: string;
  commercial_use: "allowed" | "restricted" | "unknown" | "forbidden";
  hardware: string;
  status: "available" | "adapter_only" | "disabled";
  notes: string;
  docs_url: string | null;
}

export interface UsageSummary {
  period_start: string;
  period_end: string;
  ai_edits: number;
  render_minutes: number;
  storage_mb: number;
  plan: "free" | "studio" | "enterprise";
  limits: { ai_edits: number; render_minutes: number; storage_mb: number };
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
