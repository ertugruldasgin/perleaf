import { useCallback, useEffect, useRef, useState } from "react";
import { Editor } from "./components/Editor";
import { Preview } from "./components/Preview";
import { FileList } from "./components/FileList";
import { AssetView } from "./components/AssetView";
import { submit, waitForJob, getPDF, type LogError } from "./api";
import { useCollab, useKeys, MAIN_FILE } from "./collab";

const room = new URLSearchParams(location.search).get("project") ?? "default";

export default function App() {
  const collab = useCollab(room);
  const fileNames = useKeys(collab?.files);
  const assetNames = useKeys(collab?.assets);
  const [active, setActive] = useState(MAIN_FILE);
  const [pdf, setPdf] = useState<ArrayBuffer | null>(null);
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState<LogError[]>([]);
  const [busy, setBusy] = useState(false);
  const [follow, setFollow] = useState(true);
  const lastPdfAt = useRef(0);

  const current =
    fileNames.includes(active) || assetNames.includes(active)
      ? active
      : fileNames[0];
  const ytext = current ? collab?.files.get(current) : undefined;
  const assetHash = current ? collab?.assets.get(current) : undefined;

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
      const assets = Object.fromEntries(collab.assets.entries());
      const submitted = await submit(MAIN_FILE, files, assets);
      const job =
        submitted.status === "done"
          ? submitted
          : await waitForJob(submitted.id);

      if (job.status === "failed") {
        setStatus(job.error ?? "failed");
        setErrors(job.errors ?? []);
        return;
      }

      const at = Date.now();
      lastPdfAt.current = at;
      setPdf(await getPDF(job.id));
      collab.provider.awareness.setLocalStateField("lastCompile", {
        id: job.id,
        at,
      });
      setStatus("done");
    } catch (err) {
      setStatus(String(err));
    } finally {
      setBusy(false);
    }
  }, [collab, busy]);

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

  useEffect(() => {
    if (!collab || !follow) return;
    const awareness = collab.provider.awareness;

    const onChange = () => {
      let newest: { id: string; at: number; name?: string } | undefined;
      for (const [clientID, state] of awareness.getStates()) {
        const lc = state.lastCompile;
        if (clientID === awareness.clientID || !lc) continue;
        if (lc.at > (newest?.at ?? lastPdfAt.current)) {
          newest = { id: lc.id, at: lc.at, name: state.user?.name };
        }
      }
      if (!newest) return;

      const { id, at, name } = newest;
      lastPdfAt.current = at;
      getPDF(id)
        .then((data) => {
          if (lastPdfAt.current !== at) return;
          setPdf(data);
          setStatus(`compiled by ${name ?? "someone"}`);
        })
        .catch(() => {});
    };

    onChange();
    awareness.on("change", onChange);
    return () => awareness.off("change", onChange);
  }, [collab, follow]);

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
        <label className="ml-auto flex items-center gap-1.5 text-neutral-500">
          <input
            type="checkbox"
            checked={follow}
            onChange={(e) => setFollow(e.target.checked)}
          />
          Follow others' compiles
        </label>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[12rem_1fr_1fr]">
        {collab ? (
          <FileList
            files={collab.files}
            assets={collab.assets}
            fileNames={fileNames}
            assetNames={assetNames}
            active={current}
            onSelect={setActive}
          />
        ) : (
          <aside className="border-r border-neutral-200 bg-neutral-50" />
        )}

        <div className="min-h-0 border-r border-neutral-200">
          {collab && ytext ? (
            <Editor ytext={ytext} awareness={collab.provider.awareness} />
          ) : current && assetHash ? (
            <AssetView name={current} hash={assetHash} />
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
