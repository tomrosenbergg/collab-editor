import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { yCollab } from 'y-codemirror.next'
import { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseProvider } from './SupabaseProvider'
import debounce from 'lodash/debounce'

// Colors for user cursors
const USER_COLORS = ['#30bced', '#6eeb83', '#ffbc42', '#ecd444', '#ee6352']

interface Props {
  documentId: string
  supabase: SupabaseClient
}

export const CollaborativeEditor = ({ documentId, supabase }: Props) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('Loading...')

  useEffect(() => {
    const doc = new Y.Doc()
    const provider = new SupabaseProvider(doc, supabase, documentId)
    const ytext = doc.getText('codemirror')

    // Random user color for demo purposes
    const userColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]
    provider.awareness.setLocalStateField('user', {
      name: 'User ' + Math.floor(Math.random() * 100),
      color: userColor,
    })

    // --- Persistence Logic ---
    // 1. Create a debounced save function
    const saveToDatabase = debounce((content: string) => {
      supabase
        .from('documents')
        .update({ content })
        .eq('id', documentId)
        .then(() => console.log('Saved to DB'))
    }, 2000)

    // 2. Fetch initial state (With Delay to prevent duplication)
    setTimeout(() => {
      // Check if Yjs already has content (from other users via Realtime)
      if (ytext.toString().length > 0) {
        setStatus('Synced from Peer')
        return // Stop! Don't load from DB, we already have the latest.
      }

      // If empty, we are likely the first/only one here. Load from DB.
      supabase
        .from('documents')
        .select('content')
        .eq('id', documentId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching doc:', error)
            setStatus('Error loading document')
            return
          }

          // Double check: Did text arrive via Realtime while we were fetching?
          if (doc.getText('codemirror').toString().length === 0) {
            doc.transact(() => {
               ytext.insert(0, data?.content || '')
            })
            setStatus('Loaded from DB')
          }
        })
    }, 1000) // Wait 1 second for peers to reply

    // --- Editor Setup ---
    const state = EditorState.create({
      doc: ytext.toString(), // Initial empty state, will update when Yjs syncs
      extensions: [
        basicSetup,
        javascript(),
        yCollab(ytext, provider.awareness), // Binds Yjs to CodeMirror
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            saveToDatabase(update.state.doc.toString())
          }
        })
      ],
    })

    const view = new EditorView({
      state,
      parent: editorRef.current!,
    })

    // Cleanup
    return () => {
      view.destroy()
      provider.destroy()
      saveToDatabase.cancel()
    }
  }, [documentId, supabase])

  return (
    <div>
      <div style={{ marginBottom: '10px', color: '#666' }}>Status: {status}</div>
      <div 
        ref={editorRef} 
        style={{ border: '1px solid #ccc', minHeight: '400px', textAlign: 'left' }} 
      />
    </div>
  )
}