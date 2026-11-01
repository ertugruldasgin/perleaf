import { useEffect, useRef, type RefObject } from "react";
import { EditorView, basicSetup } from "codemirror";
import { keymap } from "@codemirror/view";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import { WebsocketProvider } from "y-websocket";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";

const SNAPSHOT_MESSAGE = 100; // must match msgSnapshot in internal/collab/protocol.go

const template = String.raw`\documentclass{article}
\begin{document}
Hello from latex-editor!
\end{document}
`;

const editorTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "0.875rem" },
  "&.cm-focused": { outline: "none" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "#add6ff" },
  ".cm-scroller": {
    fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace',
    lineHeight: "1.6",
  },
  ".cm-content": { padding: "0.5rem 0" },
  ".cm-line": { padding: "0 0.25rem" },
  ".cm-gutters": {
    backgroundColor: "#fafafa",
    color: "#a3a3a3",
    borderRight: "1px solid #e5e5e5",
  },
  ".cm-activeLine": { backgroundColor: "rgba(0, 0, 0, 0.04)" },
  ".cm-activeLineGutter": { backgroundColor: "#f5f5f5", color: "#404040" },
});

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

function sendSnapshot(provider: WebsocketProvider, ydoc: Y.Doc) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, SNAPSHOT_MESSAGE);
  encoding.writeVarUint8Array(encoder, Y.encodeStateAsUpdate(ydoc));
  provider.ws?.send(encoding.toUint8Array(encoder));
}

type Props = {
  room: string;
  viewRef: RefObject<EditorView | null>;
};

export function Editor({ room, viewRef }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("main.tex");
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
      if (ytext.length === 0) ytext.insert(0, template);
      sendSnapshot(provider, ydoc);
    });

    const view = new EditorView({
      parent: parentRef.current!,
      doc: ytext.toString(),
      extensions: [
        keymap.of(yUndoManagerKeymap),
        basicSetup,
        StreamLanguage.define(stex),
        EditorView.lineWrapping,
        editorTheme,
        yCollab(ytext, provider.awareness),
      ],
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      provider.destroy();
      ydoc.destroy();
      viewRef.current = null;
    };
  }, [room]);

  return <div ref={parentRef} className="h-full" />;
}
