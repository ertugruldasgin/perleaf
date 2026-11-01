import { useCallback, useEffect, useState } from "react";
import { Editor } from "./components/Editor";
import { Preview } from "./components/Preview";
import { FileList } from "./components/FileList";
import { submit, waitForJob, getPDF, type LogError } from "./api";
import { useCollab, useFileNames, MAIN_FILE } from "./collab";

const room = new URLSearchParams(location.search).get("project") ?? "default";

export default function App() {
  const collab = useCollab(room);
  const names = useFileNames(collab?.files);
  const [active, setActive] = useState(MAIN_FILE);
  const [pdf, setPdf] = useState<ArrayBuffer | null>(null);
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState<LogError[]>([]);
  const [busy, setBusy] = useState(false);

  const current = names.includes(active) ? active : names[0];
  const ytext = current ? collab?.files.get(current) : undefined;

  const compile = useCallback(async () => {
    if (!collab || busy) return;

    setBusy(true);
    setStatus("compiling...");
    setErrors([]);
    try {
      const files = Object.fromEntries(
        Array.from(collab.files.entries(), ([name, text]) => [
          name,
          text.toString(),
        ]),
      );
      const submitted = await submit(MAIN_FILE, files);
      const job =
        submitted.status === "done"
          ? submitted
          : await waitForJob(submitted.id);

      if (job.status === "failed") {
        setStatus(job.error ?? "failed");
        setErrors(job.errors ?? []);
        return;
      }

      setPdf(await getPDF(job.id));
      setStatus("done");
    } catch (err) {
      setStatus(String(err));
    } finally {
      setBusy(false);
    }
  }, [collab, busy]);

  // Ctrl/Cmd+S compiles
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        compile();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [compile]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-neutral-200 px-3 py-2 text-sm">
        <span className="font-semibold">latex-editor</span>
        <button
          onClick={compile}
          disabled={busy || !collab}
          className="rounded bg-emerald-600 px-3 py-1 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Compile
        </button>
        <span className="text-neutral-500">{status}</span>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[12rem_1fr_1fr]">
        {collab ? (
          <FileList
            files={collab.files}
            names={names}
            active={current}
            onSelect={setActive}
          />
        ) : (
          <aside className="border-r border-neutral-200 bg-neutral-50" />
        )}

        <div className="min-h-0 border-r border-neutral-200">
          {collab && ytext ? (
            <Editor ytext={ytext} awareness={collab.provider.awareness} />
          ) : (
            <p className="p-3 text-sm text-neutral-400">Loading...</p>
          )}
        </div>

        <div className="min-h-0">
          <Preview pdf={pdf} />
        </div>
      </main>

      {errors.length > 0 && (
        <ul className="max-h-40 overflow-auto bg-red-50 px-3 py-2 font-mono text-sm text-red-700">
          {errors.map((e, i) => (
            <li key={i}>
              {e.file ? `${e.file}:${e.line}: ` : ""}
              {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
