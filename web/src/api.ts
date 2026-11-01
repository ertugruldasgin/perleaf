export type LogError = { file?: string; line?: number; message: string };

export type Job = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  error?: string;
  errors?: LogError[];
};

export async function submit(
  main: string,
  files: Record<string, string>,
): Promise<Job> {
  const res = await fetch("/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ main, files }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
}

export async function getJob(id: string): Promise<Job> {
  const res = await fetch(`/jobs/${id}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
}

export async function getPDF(id: string): Promise<ArrayBuffer> {
  const res = await fetch(`/jobs/${id}/pdf`);
  if (!res.ok) throw new Error(`pdf: ${res.status}`);
  return res.arrayBuffer();
}

export async function waitForJob(id: string, intervalMs = 500): Promise<Job> {
  for (;;) {
    const job = await getJob(id);
    if (job.status === "done" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
