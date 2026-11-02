import { cn } from "@/lib/utils";

const LEAF =
  "M43 13H42.77A8 8 0 0 0 36.89 15.58A44.88 44.88 0 0 0 36.89 76.42A8 8 0 0 0 42.77 79H43A4 4 0 0 0 47 75V17A4 4 0 0 0 43 13Z";

const LINES = [
  [13, 10.5],
  [23, 17],
  [33, 20.5],
  [43, 22],
  [53, 20.5],
  [63, 17],
  [73, 10.5],
] as const;

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="6 11 88 88"
      aria-hidden="true"
      className={cn("size-6 shrink-0", className)}
    >
      <path d={LEAF} fill="#2F6BEB" />
      <g fill="currentColor">
        {LINES.map(([y, width]) => (
          <rect key={y} x="53" y={y} width={width} height="6" rx="3" />
        ))}
        <rect x="47.5" y="84" width="5" height="12" rx="2.5" />
      </g>
    </svg>
  );
}
