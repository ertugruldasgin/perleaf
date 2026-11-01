export type LogError = { file?: string; line?: number; message: string };

export type Job = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  error?: string;
  errors?: LogError[];
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

export async function submit(
  main: string,
  files: Record<string, string>,
  assets: Record<string, string>,
): Promise<Job> {
  const res = await fetch("/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ main, files, assets }),
  });
  const body = await readJSON(res);
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
}

export async function getJob(id: string): Promise<Job> {
  const res = await fetch(`/jobs/${id}`);
  const body = await readJSON(res);
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
}

export async function getPDF(id: string): Promise<ArrayBuffer> {
  const res = await fetch(`/jobs/${id}/pdf`);
  if (!res.ok) throw new Error(`pdf: ${res.status}`);
  return res.arrayBuffer();
}

export async function uploadBlob(file: File): Promise<string> {
  const res = await fetch("/blobs", { method: "POST", body: file });
  const body = await readJSON(res);
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body.hash;
}

export async function waitForJob(id: string, intervalMs = 500): Promise<Job> {
  for (;;) {
    const job = await getJob(id);
    if (job.status === "done" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
