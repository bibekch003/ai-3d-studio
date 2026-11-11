import type {
  ApplyResponse,
  AssetRecord,
  DirectorPlan,
  EditPlan,
  JobRecord,
  ModelRecord,
  PlanResponse,
  Profile,
  Project,
  RenderRequest,
  SceneDocument,
  UsageSummary,
} from "@ai3d/shared-types";
import { apiBaseUrl, isApiConfigured } from "./product";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = "api_error",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiNotConfiguredError extends Error {
  constructor() {
    super("The API is not configured. Set NEXT_PUBLIC_API_BASE_URL to use server features.");
    this.name = "ApiNotConfiguredError";
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  if (!isApiConfigured) throw new ApiNotConfiguredError();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      let code = "http_error";
      let message = `${res.status} ${res.statusText}`;
      try {
        const body = (await res.json()) as { error?: { code?: string; message?: string } };
        if (body.error?.code) code = body.error.code;
        if (body.error?.message) message = body.error.message;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(message, res.status, code);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  me: () => request<Profile>("/api/v1/auth/me"),

  listProjects: () => request<Project[]>("/api/v1/projects"),
  createProject: (body: { name: string; description?: string }) =>
    request<Project>("/api/v1/projects", { method: "POST", body: JSON.stringify(body) }),
  getProject: (id: string) => request<Project>(`/api/v1/projects/${id}`),

  getScene: (sceneId: string) => request<{ scene: SceneDocument }>(`/api/v1/scenes/${sceneId}`),
  saveScene: (scene: SceneDocument) =>
    request<{ scene: SceneDocument }>(`/api/v1/scenes/${scene.id}`, {
      method: "PUT",
      body: JSON.stringify({ scene, expected_revision: scene.revision }),
    }),

  planEdit: (sceneId: string, prompt: string, preserve?: string[]) =>
    request<PlanResponse>(`/api/v1/ai/edit/plan`, {
      method: "POST",
      body: JSON.stringify({ scene_id: sceneId, prompt, preserve }),
    }),
  applyPlan: (sceneId: string, plan: EditPlan) =>
    request<ApplyResponse>(`/api/v1/ai/edit/apply`, {
      method: "POST",
      body: JSON.stringify({ scene_id: sceneId, plan }),
    }),
  directorPlan: (prompt: string, opts?: { fps?: number; seconds?: number }) =>
    request<DirectorPlan>("/api/v1/ai/director/plan", {
      method: "POST",
      body: JSON.stringify({ prompt, ...opts }),
    }),

  listAssets: (projectId?: string) =>
    request<AssetRecord[]>(`/api/v1/assets${projectId ? `?project_id=${projectId}` : ""}`),
  listModels: () => request<ModelRecord[]>("/api/v1/models"),
  usage: () => request<UsageSummary>("/api/v1/usage/summary"),

  createRender: (body: RenderRequest) =>
    request<JobRecord>("/api/v1/render/jobs", { method: "POST", body: JSON.stringify(body) }),
  listJobs: () => request<JobRecord[]>("/api/v1/jobs"),
  cancelJob: (id: string) => request<JobRecord>(`/api/v1/jobs/${id}/cancel`, { method: "POST" }),
  exportBlend: (sceneId: string) =>
    request<{ job: JobRecord }>(`/api/v1/export/blend`, { method: "POST", body: JSON.stringify({ scene_id: sceneId }) }),
};
