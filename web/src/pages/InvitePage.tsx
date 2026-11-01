import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { acceptInvite } from "../api";

export function InvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    acceptInvite(token)
      .then((projectId) => navigate(`/p/${projectId}`, { replace: true }))
      .catch((err: Error) => setError(err.message));
  }, [token, navigate]);

  if (!error) return null;
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 text-sm">
      <p className="text-neutral-600">{error}</p>
      <Link to="/" className="text-emerald-700 hover:underline">
        Back to projects
      </Link>
    </div>
  );
}
