import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Users } from "lucide-react";
import { Editor } from "./Editor";
import { Preview } from "./Preview";
import { FileList } from "./FileList";
import { AssetView } from "./AssetView";
import { UserMenu } from "./UserMenu";
import { SharePanel } from "./SharePanel";
import {
  submit,
  waitForJob,
  getPDF,
  type LogError,
  type Project,
  type User,
} from "../api";
import { Presence } from "./Presence";
import {
  useCollab,
  useKeys,
  usePeers,
  useConnection,
  MAIN_FILE,
} from "../collab";

type Props = {
  project: Project;
  user: User;
};

export function Workspace({ project, user }: Props) {
  const collab = useCollab(project.id, user);
  const fileNames = useKeys(collab?.files);
  const assetNames = useKeys(collab?.assets);
  const peers = usePeers(collab?.provider);
  const connection = useConnection(collab?.provider);
  const [active, setActive] = useState(MAIN_FILE);
  const [pdf, setPdf] = useState<ArrayBuffer | null>(null);
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState<LogError[]>([]);
  const [busy, setBusy] = useState(false);
  const [follow, setFollow] = useState(true);
  const [sharing, setSharing] = useState(false);
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
      const submitted = await submit(project.id, MAIN_FILE, files, assets);
      const job =
        submitted.status === "done"
          ? submitted
          : await waitForJob(project.id, submitted.id);

      if (job.status === "failed") {
        setStatus(job.error ?? "failed");
        setErrors(job.errors ?? []);
        return;
      }

      const at = Date.now();
      lastPdfAt.current = at;
      setPdf(await getPDF(project.id, job.id));
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
  }, [collab, busy, project.id]);

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
      getPDF(project.id, id)
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
  }, [collab, follow, project.id]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-neutral-200 px-3 py-2 text-sm">
        <Link to="/" className="font-semibold hover:text-neutral-600">
          latex-editor
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="font-medium">{project.name}</span>
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
        <Presence peers={peers} status={connection} />
        <button
          onClick={() => setSharing(true)}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-neutral-600 hover:bg-neutral-100"
        >
          <Users size={16} />
          Share
        </button>
        <UserMenu user={user} />
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[12rem_1fr_1fr]">
        {collab ? (
          <FileList
            project={project.id}
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
            <AssetView project={project.id} name={current} hash={assetHash} />
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

      {sharing && (
        <SharePanel
          project={project}
          user={user}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}
