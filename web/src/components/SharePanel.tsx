import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { X } from "lucide-react";
import {
  createInvite,
  listMembers,
  removeMember,
  type Member,
  type Project,
  type User,
} from "../api";

type Props = {
  project: Project;
  user: User;
  onClose: () => void;
};

export function SharePanel({ project, user, onClose }: Props) {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const isOwner = project.role === "owner";

  useEffect(() => {
    listMembers(project.id)
      .then(setMembers)
      .catch((err: Error) => setError(err.message));
  }, [project.id]);

  const invite = async () => {
    try {
      const token = await createInvite(project.id);
      setLink(`${location.origin}/invite/${token}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (m: Member) => {
    const self = m.id === user.id;
    if (
      !confirm(
        self ? "Leave this project?" : `Remove ${m.login} from this project?`,
      )
    )
      return;
    try {
      await removeMember(project.id, m.id);
      if (self) navigate("/");
      else setMembers((ms) => ms.filter((x) => x.id !== m.id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-10 flex items-start justify-center bg-black/20 pt-24"
      onClick={onClose}
    >
      <div
        className="w-96 rounded-lg border border-neutral-200 bg-white p-4 text-sm shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Share "{project.name}"</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100"
          >
            <X size={16} />
          </button>
        </div>

        <ul className="mb-4 space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <img src={m.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
              <span className="flex-1">
                {m.login}
                {m.id === user.id && (
                  <span className="text-neutral-400"> (you)</span>
                )}
              </span>
              <span className="text-xs text-neutral-500">{m.role}</span>
              {m.role !== "owner" && (isOwner || m.id === user.id) && (
                <button
                  onClick={() => remove(m)}
                  className="text-xs text-red-600 hover:underline"
                >
                  {m.id === user.id ? "Leave" : "Remove"}
                </button>
              )}
            </li>
          ))}
        </ul>

        {isOwner && (
          <>
            {link ? (
              <div className="flex gap-2">
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(link)}
                  className="rounded bg-neutral-900 px-2 py-1 text-xs text-white hover:bg-neutral-700"
                >
                  Copy
                </button>
              </div>
            ) : (
              <button
                onClick={invite}
                className="w-full rounded bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
              >
                Create invite link
              </button>
            )}
            <p className="mt-2 text-xs text-neutral-500">
              Anyone with the link can join as an editor for 7 days.
            </p>
          </>
        )}

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
