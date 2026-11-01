import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Pencil, Trash2 } from "lucide-react";
import {
  createProject,
  deleteProject,
  listProjects,
  renameProject,
  type Project,
  type User,
} from "../api";
import { UserMenu } from "../components/UserMenu";

const iconButton =
  "rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700";

export function Home({ user }: { user: User }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err: Error) => setError(err.message));
  }, []);

  const create = async () => {
    try {
      const p = await createProject(name);
      navigate(`/p/${p.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const rename = async (p: Project) => {
    const next = prompt("Project name", p.name)?.trim();
    if (!next || next === p.name) return;
    try {
      const updated = await renameProject(p.id, next);
      setProjects(
        (ps) => ps?.map((x) => (x.id === p.id ? updated : x)) ?? null,
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (p: Project) => {
    const typed = prompt(
      `This deletes "${p.name}" and its files for everyone. Type the project name to confirm:`,
    );
    if (typed === null) return;
    if (typed !== p.name) {
      alert("The name didn't match, nothing was deleted.");
      return;
    }
    try {
      await deleteProject(p.id);
      setProjects((ps) => ps?.filter((x) => x.id !== p.id) ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2 text-sm">
        <span className="font-semibold">latex-editor</span>
        <UserMenu user={user} />
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
          className="mb-6 flex gap-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New project name"
            maxLength={100}
            className="flex-1 rounded border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
          />
          <button
            disabled={!name.trim()}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Create
          </button>
        </form>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {projects &&
          (projects.length === 0 ? (
            <p className="text-sm text-neutral-500">No projects yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-200 rounded border border-neutral-200 bg-white">
              {projects.map((p) => (
                <li
                  key={p.id}
                  className="group flex items-center hover:bg-neutral-50"
                >
                  <Link
                    to={`/p/${p.id}`}
                    className="flex flex-1 items-center justify-between px-4 py-3"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-neutral-500">
                      {p.role} ·{" "}
                      {new Date(p.createdAt * 1000).toLocaleDateString()}
                    </span>
                  </Link>
                  {p.role === "owner" && (
                    <div className="hidden gap-1 pr-3 group-hover:flex">
                      <button
                        onClick={() => rename(p)}
                        title="Rename"
                        className={iconButton}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => remove(p)}
                        title="Delete"
                        className={`${iconButton} hover:text-red-600`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ))}
      </main>
    </div>
  );
}
