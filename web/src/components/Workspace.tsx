import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Play, UserPlus } from "lucide-react";
import {
  getPDF,
  submit,
  waitForJob,
  type LogError,
  type Project,
  type User,
} from "@/api";
import {
  MAIN_FILE,
  useCollab,
  useConnection,
  useKeys,
  usePeers,
} from "@/collab";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { AssetView } from "@/components/AssetView";
import { CompileErrors } from "@/components/CompileErrors";
import { Editor } from "@/components/Editor";
import { FileList } from "@/components/FileList";
import { Presence } from "@/components/Presence";
import { Preview } from "@/components/Preview";
import {
  PreviewToolbar,
  type CompileStatus,
} from "@/components/PreviewToolbar";
import { ShareDialog } from "@/components/ShareDialog";

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
  const [status, setStatus] = useState<CompileStatus>({ state: "idle" });
  const [errors, setErrors] = useState<LogError[]>([]);
  const [follow, setFollow] = useState(true);
  const [sharing, setSharing] = useState(false);
  const lastPdfAt = useRef(0);
  const busy = status.state === "compiling";

  const current =
    fileNames.includes(active) || assetNames.includes(active)
      ? active
      : fileNames[0];
  const ytext = current ? collab?.files.get(current) : undefined;
  const assetHash = current ? collab?.assets.get(current) : undefined;

  const compile = useCallback(async () => {
    if (!collab || busy) return;

    setStatus({ state: "compiling" });
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
        setStatus({ state: "failed", message: job.error ?? "compile failed" });
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
      setStatus({ state: "done" });
    } catch (err) {
      setStatus({ state: "failed", message: errorMessage(err) });
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
          setErrors([]);
          setStatus({ state: "done", by: name ?? "someone" });
        })
        .catch(() => {});
    };

    onChange();
    awareness.on("change", onChange);
    return () => awareness.off("change", onChange);
  }, [collab, follow, project.id]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader
        user={user}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSharing(true)}
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <UserPlus />
              Share
            </Button>
            <Button
              size="sm"
              onClick={compile}
              disabled={busy || !collab}
              className="cursor-pointer gap-2"
            >
              {busy ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Play className="fill-current" />
              )}
              Compile
            </Button>
          </>
        }
      >
        <span className="truncate font-medium">{project.name}</span>
        <Presence peers={peers} status={connection} />
      </AppHeader>

      <main className="grid min-h-0 flex-1 grid-cols-[13rem_minmax(0,1fr)_minmax(0,1fr)]">
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
          <aside className="border-r bg-muted/30" />
        )}

        <div className="min-h-0 border-r">
          {collab && ytext ? (
            <Editor ytext={ytext} awareness={collab.provider.awareness} />
          ) : current && assetHash ? (
            <AssetView project={project.id} name={current} hash={assetHash} />
          ) : (
            <p className="p-3 text-sm text-muted-foreground">Loading...</p>
          )}
        </div>

        <section className="flex min-h-0 min-w-0 flex-col">
          <PreviewToolbar
            status={status}
            follow={follow}
            onFollowChange={setFollow}
          />
          <div className="min-h-0 flex-1">
            <Preview pdf={pdf} />
          </div>
          {errors.length > 0 && <CompileErrors errors={errors} />}
        </section>
      </main>

      <ShareDialog
        open={sharing}
        onClose={() => setSharing(false)}
        project={project}
        user={user}
      />
    </div>
  );
}
