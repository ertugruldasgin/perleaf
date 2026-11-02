import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { Compartment } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import type * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import { useTheme, type Theme } from "@/lib/theme";

const subtle = "color-mix(in oklab, var(--foreground) 4%, transparent)";

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "0.875rem",
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: '"JetBrains Mono", ui-monospace, Menlo, monospace',
    lineHeight: "1.6",
  },
  ".cm-content": { padding: "0.5rem 0", caretColor: "var(--foreground)" },
  ".cm-line": { padding: "0 0.25rem" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 0 0 8px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "color-mix(in oklab, var(--primary) 25%, transparent)" },
  ".cm-gutters": {
    backgroundColor: "var(--background)",
    color: "var(--muted-foreground)",
    border: "none",
  },
  ".cm-activeLine": { backgroundColor: subtle },
  ".cm-activeLineGutter": {
    backgroundColor: subtle,
    color: "var(--foreground)",
  },
  ".cm-panels": { backgroundColor: "var(--muted)", color: "var(--foreground)" },
  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
  },
});

const themeCompartment = new Compartment();
const themeExtensions = (theme: Theme) =>
  theme === "dark"
    ? [EditorView.darkTheme.of(true), syntaxHighlighting(oneDarkHighlightStyle)]
    : [];

type Props = {
  ytext: Y.Text;
  awareness: WebsocketProvider["awareness"];
};

export function Editor({ ytext, awareness }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const view = new EditorView({
      parent: parentRef.current!,
      doc: ytext.toString(),
      extensions: [
        keymap.of(yUndoManagerKeymap),
        basicSetup,
        StreamLanguage.define(stex),
        EditorView.lineWrapping,
        editorTheme,
        themeCompartment.of([]),
        yCollab(ytext, awareness),
      ],
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [ytext, awareness]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeCompartment.reconfigure(themeExtensions(theme)),
    });
  }, [theme, ytext, awareness]);

  return <div ref={parentRef} className="h-full" />;
}
