import type { ConnectionStatus, Peer } from "@/collab";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const MAX_AVATARS = 5;

type Props = {
  peers: Peer[];
  status: ConnectionStatus;
};

export function Presence({ peers, status }: Props) {
  const shown = peers.slice(0, MAX_AVATARS);
  const hidden = peers.length - shown.length;

  return (
    <div className="flex items-center gap-2">
      {peers.length > 0 && (
        <div className="flex -space-x-1.5">
          {shown.map((p) => (
            <Avatar
              key={p.login}
              title={p.name}
              className="size-6"
              style={{
                boxShadow: `0 0 0 2px var(--background), 0 0 0 3.5px ${p.color}`,
              }}
            >
              <AvatarImage src={p.avatarUrl} alt={p.name} />
              <AvatarFallback
                className="text-[10px] text-white"
                style={{ backgroundColor: p.color }}
              >
                {p.login[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
          {hidden > 0 && (
            <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-background">
              +{hidden}
            </span>
          )}
        </div>
      )}

      {status === "connected" ? (
        <span
          title="Connected"
          className="size-2 rounded-full bg-emerald-500"
        />
      ) : (
        <Badge variant="outline" className="gap-1.5 font-normal">
          <span
            className={`size-1.5 rounded-full ${status === "connecting" ? "bg-amber-400" : "bg-red-500"}`}
          />
          {status === "connecting" ? "Reconnecting…" : "Offline"}
        </Badge>
      )}
    </div>
  );
}
