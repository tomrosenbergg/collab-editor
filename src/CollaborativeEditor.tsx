// src/CollaborativeEditor.tsx
import { useEffect, useRef, useMemo } from 'react'
import * as Y from 'yjs'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { yCollab } from 'y-codemirror.next'
import { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseProvider } from './SupabaseProvider'
import { useYjsPersistence } from './hooks/useYjsPersistence'

const USER_COLORS = ['#30bced', '#6eeb83', '#ffbc42', '#ecd444', '#ee6352']

// --- Minimalist Dark Theme ---
const darkScreenplayTheme = EditorView.theme({
  "&": { 
    height: "100vh",
    backgroundColor: "transparent", // Let the body background shine through
    color: "#e0e0e0" // Off-white text
  },
  ".cm-scroller": { 
    overflow: "auto",
    fontFamily: "'Courier Prime', 'Courier', monospace",
  },
  ".cm-content": { 
    caretColor: "white",
    // 1. Center the text block horizontally
    margin: "0 auto", 
    // 2. Set strict width (55ch + padding)
    maxWidth: "60ch", 
    paddingLeft: "2.5ch",
    paddingRight: "2.5ch",
    // 3. Large vertical padding allows the top/bottom lines to scroll to center
    paddingTop: "50vh", 
    paddingBottom: "50vh" 
  },
  ".cm-cursor": { 
    borderLeftColor: "white", 
    borderLeftWidth: "2px" 
  },
  ".cm-gutters": { display: "none" }, // No line numbers
  ".cm-activeLine": { backgroundColor: "transparent" }, // No highlight on current line
  ".cm-activeLineGutter": { backgroundColor: "transparent" }
})

interface Props {
  documentId: string
  supabase: SupabaseClient
}

export const CollaborativeEditor = ({ documentId, supabase }: Props) => {
  const editorRef = useRef<HTMLDivElement>(null)
  
  // Create Y.Doc instance (memoized by documentId)
  const doc = useMemo(() => new Y.Doc(), [documentId])
  
  const { status, lastSaved, loadDocument, saveDocument } = useYjsPersistence(supabase, doc)

  useEffect(() => {
    const provider = new SupabaseProvider(doc, supabase, documentId)
    const ytext = doc.getText('codemirror')

    // Set local user awareness
    provider.awareness.setLocalStateField('user', {
      name: 'Writer ' + Math.floor(Math.random() * 100),
      color: USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)],
    })

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        basicSetup,
        darkScreenplayTheme,
        yCollab(ytext, provider.awareness),
        EditorView.lineWrapping,
        
        // --- Typewriter Scroll Logic ---
        // This forces the editor to keep the cursor away from the top/bottom edges
        EditorView.scrollMargins.of((view) => {
          const dom = view.dom;
          // Calculate half the screen height
          const halfHeight = dom.clientHeight / 2;
          // Keep cursor within 10px of the center line if possible
          return { top: halfHeight - 10, bottom: halfHeight - 10 };
        }),

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

    loadDocument(documentId)

    return () => {
      view.destroy()
      provider.destroy()
      doc.destroy()
    }
  }, [documentId, supabase, doc, saveDocument, loadDocument])

  return (
    <>
      <div 
        ref={editorRef} 
        style={{ width: '100%', height: '100vh', outline: 'none' }} 
      />
      
      {/* Minimal Status Text (Bottom Right) */}
      <div style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        color: '#666', // Dim grey so it doesn't distract
        fontFamily: 'sans-serif',
        fontSize: '12px',
        pointerEvents: 'none'
      }}>
        {status === 'loading' && 'Loading...'}
        {status === 'saving' && 'Saving...'}
        {status === 'saved' && 'Saved'}
        {status === 'error' && 'Sync Error'}
      </div>
    </>
  )
}