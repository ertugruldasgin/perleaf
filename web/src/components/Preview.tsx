import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Minus, Plus } from "lucide-react";
import { renderPages } from "@/lib/pdf";
import { COMPILE_SHORTCUT } from "@/lib/config";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5];

const clamp = (z: number) => Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM);
const stepUp = (z: number) => ZOOM_STEPS.find((s) => s > z + 0.001) ?? MAX_ZOOM;
const stepDown = (z: number) =>
  ZOOM_STEPS.findLast((s) => s < z - 0.001) ?? MIN_ZOOM;

const ZOOM_SPEED = 0.007;

type Anchor = { x: number; y: number };

function scaleCanvases(el: HTMLElement, k: number) {
  if (k === 1) return;
  for (const c of el.querySelectorAll("canvas")) {
    c.style.width = `${parseFloat(c.style.width) * k}px`;
  }
}

export function Preview({ pdf }: { pdf: ArrayBuffer | null }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const hoverRef = useRef(false);
  const timerRef = useRef(0);
  const [zoom, setZoom] = useState(1);
  const [renderZoom, setRenderZoom] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!pdf || !el) return;
    let cancelled = false;

    renderPages(pdf, (el.clientWidth - 32) * renderZoom)
      .then((canvases) => {
        if (cancelled) return;
        const { scrollLeft, scrollTop } = el;
        el.replaceChildren(...canvases);
        scaleCanvases(el, zoomRef.current / renderZoom);
        el.scrollLeft = scrollLeft;
        el.scrollTop = scrollTop;
        setFailed(false);
      })
      .catch((err) => {
        console.error("pdf render:", err);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [pdf, renderZoom]);

  const applyZoom = useCallback((target: number, anchor?: Anchor) => {
    const el = scrollRef.current;
    if (!el) return;
    const next = clamp(target);
    const k = next / zoomRef.current;
    if (k === 1) return;

    const a = anchor ?? { x: el.clientWidth / 2, y: el.clientHeight / 2 };
    const { scrollLeft, scrollTop } = el;
    scaleCanvases(el, k);
    el.scrollLeft = (scrollLeft + a.x) * k - a.x;
    el.scrollTop = (scrollTop + a.y) * k - a.y;

    zoomRef.current = next;
    setZoom(next);
    clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setRenderZoom(next), 150);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const rect = el.getBoundingClientRect();
      applyZoom(zoomRef.current * Math.exp(-dy * ZOOM_SPEED), {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hoverRef.current || !(e.ctrlKey || e.metaKey)) return;
      if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd") {
        e.preventDefault();
        applyZoom(stepUp(zoomRef.current));
      } else if (e.key === "-" || e.code === "NumpadSubtract") {
        e.preventDefault();
        applyZoom(stepDown(zoomRef.current));
      } else if (e.key === "0" || e.code === "Numpad0") {
        e.preventDefault();
        applyZoom(1);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyZoom]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const zoomButton = cn(
    buttonVariants({ variant: "ghost", size: "icon" }),
    "size-7 cursor-pointer rounded-full [&_svg]:size-3.5",
  );

  return (
    <div
      className="relative h-full bg-muted"
      onPointerEnter={() => {
        hoverRef.current = true;
      }}
      onPointerLeave={() => {
        hoverRef.current = false;
      }}
    >
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
        ref={scrollRef}
        className="h-full space-y-4 overflow-auto p-4 [&_canvas]:mx-auto [&_canvas]:block [&_canvas]:h-auto [&_canvas]:rounded-sm [&_canvas]:shadow-md [&_canvas]:ring-1 [&_canvas]:ring-black/5"
      />

      {pdf && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center rounded-full border bg-background/90 px-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
          <button
            title="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => applyZoom(stepDown(zoomRef.current))}
            className={zoomButton}
          >
            <Minus />
          </button>
          <button
            title="Fit width"
            onClick={() => applyZoom(1)}
            className="h-7 w-12 cursor-pointer tabular-nums hover:text-foreground"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            title="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => applyZoom(stepUp(zoomRef.current))}
            className={zoomButton}
          >
            <Plus />
          </button>
        </div>
      )}
    </div>
  );
}
