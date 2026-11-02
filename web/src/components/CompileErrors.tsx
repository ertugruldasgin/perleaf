import type { LogError } from "@/api";

export function CompileErrors({ errors }: { errors: LogError[] }) {
  return (
    <ul className="max-h-40 shrink-0 overflow-auto border-t bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive">
      {errors.map((e, i) => (
        <li key={i} className="py-0.5">
          {e.file && (
            <span className="text-muted-foreground">
              {e.file}:{e.line}:{" "}
            </span>
          )}
          {e.message}
        </li>
      ))}
    </ul>
  );
}
