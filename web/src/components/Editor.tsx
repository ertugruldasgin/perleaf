import { useEffect, useRef, type RefObject } from "react";
import { EditorView, basicSetup } from "codemirror";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";

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

type Props = {
  initialDoc: string;
  viewRef: RefObject<EditorView | null>;
};

export function Editor({ initialDoc, viewRef }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const view = new EditorView({
      parent: parentRef.current!,
      doc: initialDoc,
      extensions: [
        basicSetup,
        StreamLanguage.define(stex),
        EditorView.lineWrapping,
        editorTheme,
      ],
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  return <div ref={parentRef} className="h-full" />;
}
