import { useRef, useState, type ChangeEvent, type ComponentType } from "react";
import * as Y from "yjs";
import { FilePlus, FileText, ImageIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadBlob } from "@/api";
import { MAIN_FILE } from "@/collab";
import { buttonVariants } from "@/components/ui/button";
import { cn, errorMessage } from "@/lib/utils";

type Props = {
  project: string;
  files: Y.Map<Y.Text>;
  assets: Y.Map<string>;
  fileNames: string[];
  assetNames: string[];
  active: string;
  onSelect: (name: string) => void;
};

type Draft = { kind: "file" } | { kind: "upload"; file: File };

const iconButton = cn(
  buttonVariants({ variant: "ghost", size: "icon" }),
  "size-7 cursor-pointer",
);

export function FileList({
  project,
  files,
  assets,
  fileNames,
  assetNames,
  active,
  onSelect,
}: Props) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const exists = (name: string) => files.has(name) || assets.has(name);

  const commit = async (name: string) => {
    const d = draft;
    setDraft(null);
    if (!d) return;

    if (d.kind === "file") {
      files.set(name, new Y.Text());
      onSelect(name);
      return;
    }

    const id = toast.loading(`Uploading ${name}…`);
    try {
      assets.set(name, await uploadBlob(project, d.file));
      toast.success(`Uploaded ${name}`, { id });
      onSelect(name);
    } catch (err) {
      toast.error(errorMessage(err), { id });
    }
  };

  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setDraft({ kind: "upload", file });
  };

  const onDeleteClick = (name: string) => {
    if (confirming !== name) {
      setConfirming(name);
      return;
    }
    setConfirming(null);
    files.delete(name);
    assets.delete(name);
  };

  const item = (name: string, isAsset: boolean) => {
    const Icon = isAsset ? ImageIcon : FileText;
    const armed = confirming === name;

    return (
      <li key={name}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect(name)}
          onKeyDown={(e) => e.key === "Enter" && onSelect(name)}
          className={cn(
            "group flex h-7 cursor-pointer items-center gap-2 rounded-md px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
            name === active
              ? "bg-foreground/8 font-medium text-foreground"
              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
          )}
        >
          <Icon
            className={cn(
              "size-3.5 shrink-0",
              name === active
                ? "text-foreground"
                : "text-muted-foreground group-hover:text-foreground",
            )}
          />
          <span className="min-w-0 flex-1 truncate">{name}</span>

          {name === MAIN_FILE ? (
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              main
            </span>
          ) : (
            <button
              title={armed ? "Click again to delete" : "Delete"}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClick(name);
              }}
              onBlur={() => setConfirming(null)}
              className={cn(
                "shrink-0 cursor-pointer rounded px-1",
                armed
                  ? "text-xs font-medium text-destructive"
                  : "invisible text-muted-foreground hover:text-destructive group-hover:visible",
              )}
            >
              {armed ? "Delete" : <Trash2 className="size-3.5" />}
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <aside className="flex min-h-0 flex-col border-r bg-muted/30">
      <div className="flex h-9 shrink-0 items-center justify-between border-b pl-3 pr-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Files
        </span>
        <div className="flex">
          <button
            onClick={() => setDraft({ kind: "file" })}
            title="New file"
            className={iconButton}
          >
            <FilePlus />
          </button>
          <button
            onClick={() => uploadRef.current?.click()}
            title="Upload image or PDF"
            className={iconButton}
          >
            <Upload />
          </button>
        </div>
        <input
          ref={uploadRef}
          type="file"
          accept=".png,.jpg,.jpeg,.pdf"
          onChange={pickFile}
          className="hidden"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-1.5">
        <ul className="grid gap-px">
          {draft?.kind === "file" && (
            <NameInput
              initial="chapter.tex"
              icon={FileText}
              exists={exists}
              onSubmit={commit}
              onCancel={() => setDraft(null)}
            />
          )}
          {fileNames.map((name) => item(name, false))}
        </ul>

        {(assetNames.length > 0 || draft?.kind === "upload") && (
          <>
            <p className="mt-4 mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Assets
            </p>
            <ul className="grid gap-px">
              {draft?.kind === "upload" && (
                <NameInput
                  initial={draft.file.name}
                  icon={ImageIcon}
                  exists={exists}
                  onSubmit={commit}
                  onCancel={() => setDraft(null)}
                />
              )}
              {assetNames.map((name) => item(name, true))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}

type NameInputProps = {
  initial: string;
  icon: ComponentType<{ className?: string }>;
  exists: (name: string) => boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
};

function NameInput({
  initial,
  icon: Icon,
  exists,
  onSubmit,
  onCancel,
}: NameInputProps) {
  const [name, setName] = useState(initial);
  const trimmed = name.trim();
  const invalid = trimmed.startsWith("/") || trimmed.split("/").includes("..");
  const taken = exists(trimmed);
  const problem = invalid
    ? "Invalid path"
    : taken
      ? `${trimmed} already exists`
      : "";

  return (
    <li className="py-0.5">
      <div className="flex h-7 items-center gap-2 rounded-md border bg-background px-2 focus-within:ring-2 focus-within:ring-ring/30">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => {
            const dot = e.target.value.lastIndexOf(".");
            e.target.setSelectionRange(
              0,
              dot > 0 ? dot : e.target.value.length,
            );
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && trimmed && !problem) onSubmit(trimmed);
            if (e.key === "Escape") onCancel();
          }}
          onBlur={onCancel}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {problem && (
        <p className="mt-1 px-2 text-xs text-destructive">{problem}</p>
      )}
    </li>
  );
}
