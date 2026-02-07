import { useEffect, useRef, useState, useMemo } from 'react'
import * as Y from 'yjs'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { yCollab } from 'y-codemirror.next'
import { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseProvider } from './SupabaseProvider'
import { useYjsPersistence } from './hooks/useYjsPersistence'

const USER_COLORS = ['#30bced', '#6eeb83', '#ffbc42', '#ecd444', '#ee6352']

// ... (Theme code remains exactly the same as previous) ...
const darkScreenplayTheme = EditorView.theme({
  "&": { height: "100vh", backgroundColor: "transparent", color: "#e0e0e0" },
  ".cm-scroller": { overflow: "auto", fontFamily: "'Courier Prime', 'Courier', monospace" },
  ".cm-content": { 
    caretColor: "white", margin: "0 auto", maxWidth: "60ch", 
    paddingLeft: "2.5ch", paddingRight: "2.5ch", paddingTop: "50vh", paddingBottom: "50vh" 
  },
  ".cm-cursor": { borderLeftColor: "white", borderLeftWidth: "2px" },
  ".cm-gutters": { display: "none" },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-activeLineGutter": { backgroundColor: "transparent" }
})

interface Props {
  documentId: string
  supabase: SupabaseClient
}

export const CollaborativeEditor = ({ documentId, supabase }: Props) => {
  const editorRef = useRef<HTMLDivElement>(null)
  
  // LIFECYCLE FIX:
  // We use useState to lazily create the Y.Doc once.
  // We DO NOT destroy it in useEffect cleanup to prevent strict mode crashes.
  // JS Garbage Collection will handle it when the component is truly discarded.
  const [doc] = useState(() => new Y.Doc())

  const { status, loadDocument, saveDocument } = useYjsPersistence(supabase, doc)

  useEffect(() => {
    // 1. Initialize Provider
    const provider = new SupabaseProvider(doc, supabase, documentId)
    const ytext = doc.getText('codemirror')

    // 2. Set Random User Info
    provider.awareness.setLocalStateField('user', {
      name: 'Writer ' + Math.floor(Math.random() * 100),
      color: USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)],
    })

    // 3. Configure Editor
    const state = EditorState.create({
      doc: ytext.toString(), // Initial text (sync logic will update this shortly)
      extensions: [
        basicSetup,
        darkScreenplayTheme,
        yCollab(ytext, provider.awareness), // Bind Yjs to CodeMirror
        EditorView.lineWrapping,
        
        // Typewriter Scrolling
        EditorView.scrollMargins.of((view) => {
          const dom = view.dom;
          const halfHeight = dom.clientHeight / 2;
          return { top: halfHeight - 10, bottom: halfHeight - 10 };
        }),

        // Save Trigger
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            saveDocument(documentId)
          }
        })
      ],
    })

    const view = new EditorView({
      state,
      parent: editorRef.current!,
    })

    // 4. Load initial state from DB
    loadDocument(documentId)

    // 5. Cleanup
    return () => {
      view.destroy()
      provider.destroy()
      // NOTE: We specifically do NOT destroy 'doc' here.
    }
  }, [documentId, supabase, doc, saveDocument, loadDocument])

  return (
    <>
      <div 
        ref={editorRef} 
        style={{ width: '100%', height: '100vh', outline: 'none' }} 
      />
      
      {/* Status Indicator */}
      <div style={{
        position: 'fixed', bottom: 20, right: 20,
        color: '#666', fontFamily: 'sans-serif', fontSize: '12px', pointerEvents: 'none'
      }}>
        {status === 'loading' && 'Loading...'}
        {status === 'saving' && 'Saving...'}
        {status === 'saved' && 'Saved'}
        {status === 'error' && 'Sync Error'}
      </div>
    </>
  )
}