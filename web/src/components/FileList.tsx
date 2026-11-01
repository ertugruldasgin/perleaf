import * as Y from "yjs";
import { MAIN_FILE } from "../collab";

type Props = {
  files: Y.Map<Y.Text>;
  names: string[];
  active: string;
  onSelect: (name: string) => void;
};

export function FileList({ files, names, active, onSelect }: Props) {
  const addFile = () => {
    const name = prompt("File name", "chapter.tex")?.trim();
    if (!name) return;
    if (files.has(name)) {
      alert(`${name} already exists`);
      return;
    }
    files.set(name, new Y.Text());
    onSelect(name);
  };

  const deleteFile = (name: string) => {
    if (confirm(`Delete ${name}?`)) files.delete(name);
  };

  return (
    <aside className="flex min-h-0 flex-col border-r border-neutral-200 bg-neutral-50 text-sm">
      <div className="flex items-center justify-between px-3 py-2 font-medium text-neutral-500">
        <span>Files</span>
        <button
          onClick={addFile}
          title="New file"
          className="rounded px-1.5 hover:bg-neutral-200"
        >
          +
        </button>
      </div>
      <ul className="min-h-0 flex-1 overflow-auto">
        {names.map((name) => (
          <li
            key={name}
            onClick={() => onSelect(name)}
            className={`group flex cursor-pointer items-center justify-between px-3 py-1 ${
              name === active
                ? "bg-neutral-200 font-medium"
                : "hover:bg-neutral-100"
            }`}
          >
            <span className="truncate">{name}</span>
            {name !== MAIN_FILE && (
              <button
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFile(name);
                }}
                className="hidden px-1 text-neutral-400 hover:text-red-600 group-hover:block"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
