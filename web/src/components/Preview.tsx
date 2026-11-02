import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { renderPages } from "@/lib/pdf";
import { COMPILE_SHORTCUT } from "@/lib/config";

export function Preview({ pdf }: { pdf: ArrayBuffer | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!pdf || !el) return;
    let cancelled = false;

    const width = el.clientWidth - 32;
    renderPages(pdf, width)
      .then((canvases) => {
        if (cancelled) return;
        el.replaceChildren(...canvases);
        setFailed(false);
      })
      .catch((err) => {
        console.error("pdf render:", err);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [pdf]);

  return (
    <div className="relative h-full bg-muted">
      {!pdf && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
          <FileText className="size-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">No preview yet</p>
          <p className="text-xs text-muted-foreground">
            Press{" "}
            <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[11px]">
              {COMPILE_SHORTCUT}
            </kbd>{" "}
            to compile
          </p>
        </div>
      )}

      {failed && (
        <p className="absolute inset-x-3 top-3 z-10 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Couldn't render this PDF.
        </p>
      )}

      <div
        ref={ref}
        className="h-full space-y-4 overflow-auto p-4 [&_canvas]:mx-auto [&_canvas]:block [&_canvas]:h-auto [&_canvas]:w-full [&_canvas]:rounded-sm [&_canvas]:shadow-md [&_canvas]:ring-1 [&_canvas]:ring-black/5"
      />
    </div>
  );
}
