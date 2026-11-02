import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { COMPILE_SHORTCUT } from "@/lib/config";

export type CompileStatus =
  | { state: "idle" }
  | { state: "compiling" }
  | { state: "done"; by?: string }
  | { state: "failed"; message: string };

type Props = {
  status: CompileStatus;
  follow: boolean;
  onFollowChange: (follow: boolean) => void;
};

export function PreviewToolbar({ status, follow, onFollowChange }: Props) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-3 border-b px-3 text-xs">
      <StatusText status={status} />
      <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-2 text-muted-foreground">
        <Switch checked={follow} onCheckedChange={onFollowChange} />
        Follow collaborators
      </label>
    </div>
  );
}

function StatusText({ status }: { status: CompileStatus }) {
  switch (status.state) {
    case "idle":
      return (
        <span className="text-muted-foreground">
          Press {COMPILE_SHORTCUT} to compile
        </span>
      );
    case "compiling":
      return (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Compiling…
        </span>
      );
    case "done":
      return (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-500" />
          {status.by ? `Compiled by ${status.by}` : "Compiled"}
        </span>
      );
    case "failed":
      return (
        <span className="flex min-w-0 items-center gap-1.5 text-destructive">
          <XCircle className="size-3.5 shrink-0" />
          <span className="truncate">{status.message}</span>
        </span>
      );
  }
}
