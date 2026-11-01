import { useRef, type ChangeEvent } from "react";
import * as Y from "yjs";
import { FilePlus, FileText, ImageIcon, Upload, X } from "lucide-react";
import { MAIN_FILE } from "../collab";
import { uploadBlob } from "../api";

type Props = {
  project: string;
  files: Y.Map<Y.Text>;
  assets: Y.Map<string>;
  fileNames: string[];
  assetNames: string[];
  active: string;
  onSelect: (name: string) => void;
};

const iconButton = "rounded p-1 hover:bg-neutral-200 hover:text-neutral-800";

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

  const askName = (suggested: string) => {
    const name = prompt("File name", suggested)?.trim();
    if (!name) return null;
    if (files.has(name) || assets.has(name)) {
      alert(`${name} already exists`);
      return null;
    }
    return name;
  };

  const addFile = () => {
    const name = askName("chapter.tex");
    if (!name) return;
    files.set(name, new Y.Text());
    onSelect(name);
  };

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const name = askName(file.name);
    if (!name) return;
    try {
      assets.set(name, await uploadBlob(project, file));
      onSelect(name);
    } catch (err) {
      alert(String(err));
    }
  };

  const remove = (name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    files.delete(name);
    assets.delete(name);
  };

  const item = (name: string, isAsset: boolean) => {
    const Icon = isAsset ? ImageIcon : FileText;
    return (
      <li
        key={name}
        onClick={() => onSelect(name)}
        className={`group flex cursor-pointer items-center justify-between gap-2 px-3 py-1 ${
          name === active
            ? "bg-neutral-200 font-medium"
            : "hover:bg-neutral-100"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon size={14} className="shrink-0 text-neutral-400" />
          <span className="truncate">{name}</span>
        </span>
        {name !== MAIN_FILE && (
          <button
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              remove(name);
            }}
            className="hidden shrink-0 text-neutral-400 hover:text-red-600 group-hover:block"
          >
            <X size={14} />
          </button>
        )}
      </li>
    );
  };

  return (
    <aside className="flex min-h-0 flex-col border-r border-neutral-200 bg-neutral-50 text-sm">
      <div className="flex items-center justify-between px-3 py-2 font-medium text-neutral-500">
        <span>Files</span>
        <div className="flex gap-0.5">
          <button onClick={addFile} title="New file" className={iconButton}>
            <FilePlus size={16} />
          </button>
          <button
            onClick={() => uploadRef.current?.click()}
            title="Upload image"
            className={iconButton}
          >
            <Upload size={16} />
          </button>
        </div>
        <input
          ref={uploadRef}
          type="file"
          accept=".png,.jpg,.jpeg,.pdf"
          onChange={upload}
          className="hidden"
        />
      </div>
      <ul className="min-h-0 flex-1 overflow-auto">
        {fileNames.map((name) => item(name, false))}
        {assetNames.map((name) => item(name, true))}
      </ul>
    </aside>
  );
}
