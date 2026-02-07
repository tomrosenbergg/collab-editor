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

interface Props {
  documentId: string
  supabase: SupabaseClient
}

// Custom Theme (Unchanged)
const screenplayTheme = EditorView.theme({
  "&": { color: "white", backgroundColor: "transparent" },
  ".cm-gutters": { display: "none !important" },
  ".cm-activeLine": { backgroundColor: "transparent !important" },
  ".cm-activeLineGutter": { backgroundColor: "transparent !important" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "white !important" },
  ".cm-content": { padding: "0" }
})

export const CollaborativeEditor = ({ documentId, supabase }: Props) => {
  const editorRef = useRef<HTMLDivElement>(null)
  
  // 1. Create the Y.Doc instance once per lifecycle
  const doc = useMemo(() => new Y.Doc(), [])
  
  // 2. Initialize Persistence Hook
  const { status, lastSaved, loadDocument, saveDocument } = useYjsPersistence(supabase, doc)

  useEffect(() => {
    // 3. Connect to Supabase Realtime (Transport)
    const provider = new SupabaseProvider(doc, supabase, documentId)
    const ytext = doc.getText('codemirror')

    // Set local awareness (User info)
    const userColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]
    provider.awareness.setLocalStateField('user', {
      name: 'User ' + Math.floor(Math.random() * 100),
      color: userColor,
    })

    // 4. Initialize CodeMirror
    const state = EditorState.create({
      doc: ytext.toString(), // Initially empty until DB loads or peers sync
      extensions: [
        basicSetup,
        screenplayTheme,
        yCollab(ytext, provider.awareness),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            // Trigger debounced save on every keystroke
            saveDocument(documentId)
          }
        })
      ],
    })

    const view = new EditorView({
      state,
      parent: editorRef.current!,
    })

    // 5. Load Data (Fire and forget - Yjs handles the merge)
    loadDocument(documentId).then(() => {
       // Optional: You could view.focus() here if you want
    })

    // Cleanup
    return () => {
      view.destroy()
      provider.destroy()
      doc.destroy()
    }
  }, [documentId, supabase, doc]) // Dependencies rely on stable instances

  return (
    <div style={{ position: 'relative' }}>
      <div 
        ref={editorRef} 
        style={{ textAlign: 'left' }} 
      />
      
      {/* Status Bar */}
      <div style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        padding: '8px 12px',
        borderRadius: '20px',
        backgroundColor: '#333',
        fontSize: '12px',
        color: '#aaa',
        border: '1px solid #444'
      }}>
        {status === 'loading' && 'Loading...'}
        {status === 'saving' && 'Saving...'}
        {status === 'saved' && lastSaved && `Saved ${lastSaved.toLocaleTimeString()}`}
        {status === 'error' && <span style={{color: '#ff6b6b'}}>Sync Error</span>}
      </div>
    </div>
  )
}