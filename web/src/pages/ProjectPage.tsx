import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { getProject, type Project, type User } from "../api";
import { Workspace } from "../components/Workspace";

export function ProjectPage({ user }: { user: User }) {
  const { id = "" } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getProject(id)
      .then(setProject)
      .catch((err: Error) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-sm">
        <p className="text-neutral-600">{error}</p>
        <Link to="/" className="text-emerald-700 hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }
  if (!project) return null;
  return <Workspace key={project.id} project={project} user={user} />;
}
