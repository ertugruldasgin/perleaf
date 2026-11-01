import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorView } from "codemirror";
import { Editor } from "./components/Editor";
import { Preview } from "./components/Preview";
import { submit, waitForJob, getPDF, type LogError } from "./api";

const room = new URLSearchParams(location.search).get("project") ?? "default";

export default function App() {
  const viewRef = useRef<EditorView | null>(null);
  const [pdf, setPdf] = useState<ArrayBuffer | null>(null);
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState<LogError[]>([]);
  const [busy, setBusy] = useState(false);

  const compile = useCallback(async () => {
    const view = viewRef.current;
    if (!view || busy) return;

    setBusy(true);
    setStatus("compiling...");
    setErrors([]);
    try {
      const submitted = await submit("main.tex", {
        "main.tex": view.state.doc.toString(),
      });
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
  }, [busy]);

  // ctrl+s compiles
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
      <header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-6 py-2 text-sm">
        <span className="font-semibold">latex-editor</span>
        <div className="flex items-center gap-6">
          <button
            onClick={compile}
            disabled={busy}
            className="rounded bg-emerald-600 hover:bg-emerald-700 px-3 py-1 font-medium text-white disabled:opacity-50 hover:cursor-pointer"
          >
            Compile
          </button>
          <span className="text-neutral-500">{status}</span>
        </div>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-2">
        <div className=" min-h-0 border-r border-neutral-200">
          <Editor room={room} viewRef={viewRef} />
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
