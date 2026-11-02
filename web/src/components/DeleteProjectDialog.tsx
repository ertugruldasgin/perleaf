import { useState } from "react";
import type { Project } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/utils";

type Props = {
  project: Project | null;
  onClose: () => void;
  onDelete: (project: Project) => Promise<void>;
};

export function DeleteProjectDialog({ project, onClose, onDelete }: Props) {
  return (
    <Dialog open={project !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {project && (
          <DeleteForm
            key={project.id}
            project={project}
            onClose={onClose}
            onDelete={onDelete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeleteForm({
  project,
  onClose,
  onDelete,
}: Props & { project: Project }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    try {
      await onDelete(project);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid gap-4"
    >
      <DialogHeader>
        <DialogTitle>Delete project</DialogTitle>
        <DialogDescription>
          This permanently deletes{" "}
          <span className="font-medium text-foreground">{project.name}</span>{" "}
          and its files for every member. Type the project name to confirm.
        </DialogDescription>
      </DialogHeader>
      <Input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={project.name}
        autoFocus
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={typed !== project.name || busy}
        >
          Delete
        </Button>
      </DialogFooter>
    </form>
  );
}
