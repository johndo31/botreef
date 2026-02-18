const BASE_URL = "/api/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("botreef_api_key") ?? "";
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Tasks
  createTask: (projectId: string, instruction: string) =>
    request<{ jobId: string }>("/tasks", {
      method: "POST",
      body: JSON.stringify({ projectId, instruction }),
    }),
  getTask: (id: string) => request<any>(`/tasks/${id}`),
  listTasks: () => request<{ tasks: any[]; total: number }>("/tasks"),

  // Projects
  listProjects: () => request<{ projects: any[] }>("/projects"),
  getProject: (id: string) => request<any>(`/projects/${id}`),

  // Kanban
  getBoard: (projectId: string) =>
    request<{ board: any; stories: any[] }>(`/projects/${projectId}/board`),
  createStory: (projectId: string, data: any) =>
    request<any>(`/projects/${projectId}/stories`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateStory: (storyId: string, data: any) =>
    request<any>(`/stories/${storyId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteStory: (storyId: string) =>
    request<void>(`/stories/${storyId}`, { method: "DELETE" }),
};

export function createSSEStream(jobId: string, onEvent: (event: any) => void): EventSource {
  const token = localStorage.getItem("botreef_api_key") ?? "";
  const es = new EventSource(`${BASE_URL}/tasks/${jobId}/stream?token=${token}`);
  es.onmessage = (e) => onEvent(JSON.parse(e.data));
  es.addEventListener("task:completed", (e) => {
    onEvent({ type: "task:completed", ...JSON.parse((e as MessageEvent).data) });
    es.close();
  });
  es.addEventListener("task:failed", (e) => {
    onEvent({ type: "task:failed", ...JSON.parse((e as MessageEvent).data) });
    es.close();
  });
  return es;
}
