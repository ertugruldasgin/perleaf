import { useEffect, useState } from "react";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import { WebsocketProvider } from "y-websocket";

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
};

export function useCollab(room: string): Collab | null {
  const [collab, setCollab] = useState<Collab | null>(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const files = ydoc.getMap<Y.Text>("files");
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const provider = new WebsocketProvider(
      `${protocol}://${location.host}/ws`,
      room,
      ydoc,
      {
        disableBc: true,
      },
    );

    const color = cursorColors[Math.floor(Math.random() * cursorColors.length)];
    provider.awareness.setLocalStateField("user", {
      name: `Anonymous ${Math.floor(Math.random() * 100)}`,
      color,
      colorLight: color + "33",
    });

    provider.on("sync", (synced: boolean) => {
      if (!synced) return;
      if (files.size === 0) files.set(MAIN_FILE, new Y.Text(template));
      sendSnapshot(provider, ydoc);
    });

    setCollab({ provider, files });

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [room]);

  return collab;
}

export function useFileNames(files: Y.Map<Y.Text> | undefined): string[] {
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    if (!files) return;
    const update = () => setNames([...files.keys()].sort());
    update();
    files.observe(update);
    return () => files.unobserve(update);
  }, [files]);

  return names;
}

function sendSnapshot(provider: WebsocketProvider, ydoc: Y.Doc) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, SNAPSHOT_MESSAGE);
  encoding.writeVarUint8Array(encoder, Y.encodeStateAsUpdate(ydoc));
  provider.ws?.send(encoding.toUint8Array(encoder));
}
