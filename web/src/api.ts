export type LogError = { file?: string; line?: number; message: string };

export type Job = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  error?: string;
  errors?: LogError[];
};

export type User = {
  id: number;
  login: string;
  name: string;
  avatarUrl: string;
};

export type Member = User & { role: "owner" | "editor" };

export type Project = {
  id: string;
  name: string;
  role: "owner" | "editor";
  createdAt: number;
};

async function readJSON(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `${res.status} ${res.statusText}${text ? `: ${text}` : ""}`,
    );
  }
}

export async function getMe(): Promise<User | null> {
  const res = await fetch("/api/me");
  if (res.status === 401) return null;
  const body = await readJSON(res);
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
}

export async function logout(): Promise<void> {
  await fetch("/auth/logout", { method: "POST" });
}

export async function listMembers(project: string): Promise<Member[]> {
  const res = await fetch(`/api/projects/${project}/members`);
  const body = await readJSON(res);
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
}

export async function removeMember(
  project: string,
  userId: number,
): Promise<void> {
  const res = await fetch(`/api/projects/${project}/members/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await readJSON(res);
    throw new Error(body.error ?? res.statusText);
  }
}

export async function createInvite(project: string): Promise<string> {
  const res = await fetch(`/api/projects/${project}/invites`, {
    method: "POST",
  });
  const body = await readJSON(res);
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body.token;
}

export async function acceptInvite(token: string): Promise<string> {
  const res = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
  const body = await readJSON(res);
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body.projectId;
}

export async function listProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  const body = await readJSON(res);
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
}

export async function createProject(name: string): Promise<Project> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const body = await readJSON(res);
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
}

export async function renameProject(
  id: string,
  name: string,
): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const body = await readJSON(res);
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await readJSON(res);
    throw new Error(body.error ?? res.statusText);
  }
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`);
  const body = await readJSON(res);
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
}

export async function submit(
  project: string,
  main: string,
  files: Record<string, string>,
  assets: Record<string, string>,
): Promise<Job> {
  const res = await fetch(`/api/projects/${project}/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ main, files, assets }),
  });
  const body = await readJSON(res);
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
}

export async function getJob(project: string, id: string): Promise<Job> {
  const res = await fetch(`/api/projects/${project}/jobs/${id}`);
  const body = await readJSON(res);
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
}

export async function getPDF(
  project: string,
  id: string,
): Promise<ArrayBuffer> {
  const res = await fetch(`/api/projects/${project}/jobs/${id}/pdf`);
  if (!res.ok) throw new Error(`pdf: ${res.status}`);
  return res.arrayBuffer();
}

export async function uploadBlob(project: string, file: File): Promise<string> {
  const res = await fetch(`/api/projects/${project}/blobs`, {
    method: "POST",
    body: file,
  });
  const body = await readJSON(res);
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body.hash;
}

export async function waitForJob(
  project: string,
  id: string,
  intervalMs = 500,
): Promise<Job> {
  for (;;) {
    const job = await getJob(project, id);
    if (job.status === "done" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
