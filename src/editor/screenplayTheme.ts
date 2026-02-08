import { EditorView } from 'codemirror'

export const screenplayTheme = EditorView.theme({
  "&": { height: "100vh", backgroundColor: "transparent", color: "#e0e0e0" },
  ".cm-scroller": { overflow: "auto", fontFamily: "'Courier Prime', 'Courier', monospace" },
  ".cm-content": {
    caretColor: "white",
    margin: "0 auto",
    maxWidth: "60ch",
    paddingLeft: "2.5ch",
    paddingRight: "2.5ch",
    paddingTop: "50vh",
    paddingBottom: "50vh",
  },
  ".cm-cursor": { borderLeftColor: "white", borderLeftWidth: "2px" },
  ".cm-gutters": { display: "none" },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
})
