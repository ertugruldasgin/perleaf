import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import { WebsocketProvider } from "y-websocket";
import type { User } from "./api";

export const MAIN_FILE = "main.tex";

const SNAPSHOT_MESSAGE = 100; // must match msgSnapshot in internal/collab/protocol.go

const template = String.raw`\documentclass{article}
\begin{document}
Hello from latex-editor!
\end{document}
`;

const cursorColors = [
  "#30bced",
  "#6eeb83",
  "#ffbc42",
  "#ee6352",
  "#9b5de5",
  "#f15bb5",
  "#00bbf9",
  "#00a676",
];

export type Collab = {
  provider: WebsocketProvider;
  files: Y.Map<Y.Text>; // path -> content
  assets: Y.Map<string>; // path -> blob hash
};

export function useCollab(room: string, user: User): Collab | null {
  const [collab, setCollab] = useState<Collab | null>(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const files = ydoc.getMap<Y.Text>("files");
    const assets = ydoc.getMap<string>("assets");
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const provider = new WebsocketProvider(
      `${protocol}://${location.host}/ws`,
      room,
      ydoc,
      {
        disableBc: true,
      },
    );

    const color = cursorColors[user.id % cursorColors.length];
    provider.awareness.setLocalStateField("user", {
      name: user.name,
      login: user.login,
      avatarUrl: user.avatarUrl,
      color,
      colorLight: color + "33",
    });
    const collab: Collab = { provider, files, assets };

    provider.on("sync", (synced: boolean) => {
      if (!synced) return;
      if (files.size === 0) files.set(MAIN_FILE, new Y.Text(template));
      sendSnapshot(provider, ydoc);
      setCollab(collab);
    });

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [room, user]);

  return collab;
}

export function useKeys<T>(map: Y.Map<T> | undefined): string[] {
  const [keys, setKeys] = useState<string[]>([]);

  useEffect(() => {
    if (!map) return;
    const update = () => setKeys([...map.keys()].sort());
    update();
    map.observe(update);
    return () => map.unobserve(update);
  }, [map]);

  return keys;
}

function sendSnapshot(provider: WebsocketProvider, ydoc: Y.Doc) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, SNAPSHOT_MESSAGE);
  encoding.writeVarUint8Array(encoder, Y.encodeStateAsUpdate(ydoc));
  provider.ws?.send(encoding.toUint8Array(encoder));
}

export type Peer = {
  login: string;
  name: string;
  avatarUrl: string;
  color: string;
};
export type ConnectionStatus = "connected" | "connecting" | "disconnected";

export function usePeers(provider: WebsocketProvider | undefined): Peer[] {
  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => {
    if (!provider) return;
    const awareness = provider.awareness;

    const update = () => {
      const me = awareness.getLocalState()?.user?.login;
      const byLogin = new Map<string, Peer>();
      for (const state of awareness.getStates().values()) {
        const u = state.user;
        if (!u?.login || u.login === me) continue;
        byLogin.set(u.login, {
          login: u.login,
          name: u.name,
          avatarUrl: u.avatarUrl,
          color: u.color,
        });
      }
      const next = [...byLogin.values()].sort((a, b) =>
        a.login.localeCompare(b.login),
      );
      setPeers((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
      );
    };

    update();
    awareness.on("change", update);
    return () => awareness.off("change", update);
  }, [provider]);

  return peers;
}

export function useConnection(
  provider: WebsocketProvider | undefined,
): ConnectionStatus {
  const subscribe = useCallback(
    (onChange: () => void) => {
      provider?.on("status", onChange);
      return () => provider?.off("status", onChange);
    },
    [provider],
  );

  return useSyncExternalStore(subscribe, () => {
    if (!provider) return "connecting";
    if (provider.wsconnected) return "connected";
    return provider.wsconnecting ? "connecting" : "disconnected";
  });
}
