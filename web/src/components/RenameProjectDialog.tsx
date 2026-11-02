import { useState } from "react";
import type { Project } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/utils";

type Props = {
  project: Project | null;
  onClose: () => void;
  onRename: (project: Project, name: string) => Promise<void>;
};

export function RenameProjectDialog({ project, onClose, onRename }: Props) {
  return (
    <Dialog open={project !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {project && (
          <RenameForm
            key={project.id}
            project={project}
            onClose={onClose}
            onRename={onRename}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  project,
  onClose,
  onRename,
}: Props & { project: Project }) {
  const [name, setName] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const trimmed = name.trim();

  const submit = async () => {
    setBusy(true);
    try {
      await onRename(project, trimmed);
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
        <DialogTitle>Rename project</DialogTitle>
      </DialogHeader>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        autoFocus
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!trimmed || trimmed === project.name || busy}
        >
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
