import type { ConnectionStatus, Peer } from "../collab";

const dotColor: Record<ConnectionStatus, string> = {
  connected: "bg-emerald-500",
  connecting: "bg-amber-400",
  disconnected: "bg-red-500",
};

type Props = {
  peers: Peer[];
  status: ConnectionStatus;
};

export function Presence({ peers, status }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {peers.map((p) => {
          const ring = { boxShadow: `0 0 0 2px ${p.color}` };
          return p.avatarUrl ? (
            <img
              key={p.login}
              src={p.avatarUrl}
              alt={p.name}
              title={p.name}
              style={ring}
              className="h-6 w-6 rounded-full"
            />
          ) : (
            <span
              key={p.login}
              title={p.name}
              style={{ ...ring, backgroundColor: p.color }}
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium text-white"
            >
              {p.login[0]?.toUpperCase()}
            </span>
          );
        })}
      </div>
      <span
        title={status}
        className={`h-2 w-2 rounded-full ${dotColor[status]}`}
      />
      {status !== "connected" && (
        <span className="text-xs text-neutral-500">{status}</span>
      )}
    </div>
  );
}
