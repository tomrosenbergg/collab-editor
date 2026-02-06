import { useEffect, useRef } from 'react'
import * as Y from 'yjs'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { yCollab } from 'y-codemirror.next'
import { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseProvider } from './SupabaseProvider'
import debounce from 'lodash/debounce'

const USER_COLORS = ['#30bced', '#6eeb83', '#ffbc42', '#ecd444', '#ee6352']

interface Props {
  documentId: string
  supabase: SupabaseClient
}

// Custom Theme to override CodeMirror defaults
const screenplayTheme = EditorView.theme({
  "&": {
    color: "white",
    backgroundColor: "transparent",
  },
  // Hide the gutter (line numbers)
  ".cm-gutters": {
    display: "none !important"
  },
  // Remove active line highlighting
  ".cm-activeLine": {
    backgroundColor: "transparent !important"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent !important"
  },
  // Force Cursor to be white
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "white !important"
  },
  // Ensure the content area matches the container width
  ".cm-content": {
    padding: "0" 
  }
})

export const CollaborativeEditor = ({ documentId, supabase }: Props) => {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const doc = new Y.Doc()
    const provider = new SupabaseProvider(doc, supabase, documentId)
    const ytext = doc.getText('codemirror')

    const userColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]
    provider.awareness.setLocalStateField('user', {
      name: 'User ' + Math.floor(Math.random() * 100),
      color: userColor,
    })

    // Save to DB (debounced)
    const saveToDatabase = debounce(() => {
      provider.saveStateToSupabase(supabase, documentId)
        .then(({ error }) => {
          if (!error) console.log('Binary state saved to DB')
          else console.error('Save error:', error)
        })
    }, 2000)

    let receivedPeerData = false
    const onUpdate = (_update: Uint8Array, origin: any) => {
      if (origin === 'remote') {
        receivedPeerData = true
        console.log('Synced from Peer')
      }
    }
    doc.on('update', onUpdate)

    const initLoad = async () => {
      console.log('Connecting...')
      
      // 1. Handshake: Give peers 2 seconds to respond with live data
      await new Promise(resolve => setTimeout(resolve, 2000))

      if (receivedPeerData || ytext.toString().length > 0) {
        doc.off('update', onUpdate)
        return 
      }

      // 2. Fallback: Load from Database
      console.log('Loading from DB...')
      const { data, error } = await supabase
        .from('documents')
        .select('content')
        .eq('id', documentId)
        .maybeSingle()

      if (error) {
        console.error('Fetch Error:', error)
      } else if (data?.content) {
        try {
          let rawContent = data.content
          
          // --- ROBUST DECODING START ---
          if (typeof rawContent === 'string') {
            const hex = rawContent.startsWith('\\x') 
              ? rawContent.slice(2) 
              : rawContent

            if (/^[0-9a-fA-F]*$/.test(hex)) {
               const match = hex.match(/.{1,2}/g)
               if (match) {
                 rawContent = new Uint8Array(match.map(byte => parseInt(byte, 16)))
               } else {
                 rawContent = new Uint8Array([])
               }
            } else {
               try {
                  const parsed = JSON.parse(rawContent)
                  if (Array.isArray(parsed)) rawContent = new Uint8Array(parsed)
               } catch (e) {
                  console.warn('Content string is neither Hex nor JSON array')
               }
            }
          } 
          else if (Array.isArray(rawContent)) {
             rawContent = new Uint8Array(rawContent)
          }
          // --- ROBUST DECODING END ---

          if (rawContent instanceof Uint8Array && rawContent.length > 0) {
            Y.applyUpdate(doc, rawContent, 'initial-db-load')
            console.log('Loaded from DB')
          } else {
            console.log('New Document (Empty DB Content)')
          }
        } catch (e) {
          console.error('Yjs Decoding Error:', e)
        }
      } else {
        console.log('New Document')
      }
      doc.off('update', onUpdate)
    }

    initLoad()

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        basicSetup,
        screenplayTheme, // Apply custom visual theme
        yCollab(ytext, provider.awareness),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            saveToDatabase()
          }
        })
      ],
    })

    const view = new EditorView({
      state,
      parent: editorRef.current!,
    })

    // Auto-focus the editor immediately
    view.focus()

    return () => {
      view.destroy()
      provider.destroy()
      saveToDatabase.cancel()
    }
  }, [documentId, supabase])

  return (
    <div 
      ref={editorRef} 
      style={{ textAlign: 'left' }} 
    />
  )
}