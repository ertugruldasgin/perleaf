import { useEffect, useRef } from "react";
import { renderPages } from "../lib/pdf";

export function Preview({ pdf }: { pdf: ArrayBuffer | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!pdf || !el) return;
    let cancelled = false;

    const width = el.clientWidth - 24;
    renderPages(pdf, width)
      .then((canvases) => {
        if (!cancelled) el.replaceChildren(...canvases);
      })
      .catch((err) => console.error("pdf render:", err));

    return () => {
      cancelled = true;
    };
  }, [pdf]);

  return (
    <div className="relative h-full">
      {!pdf && (
        <p className="absolute inset-0 grid place-items-center text-base text-neutral-300">
          Press Ctrl+S to compile
        </p>
      )}
      <div
        ref={ref}
        className="h-full space-y-3 overflow-auto bg-neutral-600 p-3 [&_canvas]:mx-auto [&_canvas]:block [&_canvas]:h-auto [&_canvas]:w-full [&_canvas]:shadow-md"
      />
    </div>
  );
}
