import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { yCollab } from 'y-codemirror.next'
import { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseProvider } from './SupabaseProvider'
import debounce from 'lodash/debounce'

const USER_COLORS = ['#30bced', '#6eeb83', '#ffbc42', '#ecd444', '#ee6352']

interface Props {
  documentId: string
  supabase: SupabaseClient
}

export const CollaborativeEditor = ({ documentId, supabase }: Props) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('Connecting...')

  useEffect(() => {
    const doc = new Y.Doc()
    const provider = new SupabaseProvider(doc, supabase, documentId)
    const ytext = doc.getText('codemirror')

    // Random user color for cursor awareness
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
        setStatus('Synced from Peer')
      }
    }
    doc.on('update', onUpdate)

    const initLoad = async () => {
      // 1. Handshake: Give peers 2 seconds to respond with live data [cite: 34]
      await new Promise(resolve => setTimeout(resolve, 2000))

      if (receivedPeerData || ytext.toString().length > 0) {
        doc.off('update', onUpdate)
        return 
      }

      // 2. Fallback: Load from Database
      setStatus('Loading from DB...')
      const { data, error } = await supabase
        .from('documents')
        .select('content')
        .eq('id', documentId)
        .maybeSingle()

      if (error) {
        console.error('Fetch Error:', error)
        setStatus('Error loading document')
      } else if (data?.content) {
        try {
          let rawContent = data.content
          
          // --- ROBUST DECODING START ---
          
          // Case A: Postgres Bytea Hex String (e.g., "\x010203...")
          if (typeof rawContent === 'string') {
            // Remove '\x' prefix if present
            const hex = rawContent.startsWith('\\x') 
              ? rawContent.slice(2) 
              : rawContent

            // Ensure valid hex before parsing
            if (/^[0-9a-fA-F]*$/.test(hex)) {
               const match = hex.match(/.{1,2}/g)
               if (match) {
                 rawContent = new Uint8Array(match.map(byte => parseInt(byte, 16)))
               } else {
                 rawContent = new Uint8Array([])
               }
            } else {
               // Fallback: Try parsing as JSON string (edge case)
               try {
                  const parsed = JSON.parse(rawContent)
                  if (Array.isArray(parsed)) rawContent = new Uint8Array(parsed)
               } catch (e) {
                  console.warn('Content string is neither Hex nor JSON array')
               }
            }
          } 
          // Case B: Standard Array (e.g. from JSONB column or legacy save)
          else if (Array.isArray(rawContent)) {
             rawContent = new Uint8Array(rawContent)
          }

          // --- ROBUST DECODING END ---

          // Apply the binary update to Y.Doc if valid
          if (rawContent instanceof Uint8Array && rawContent.length > 0) {
            Y.applyUpdate(doc, rawContent, 'initial-db-load')
            setStatus('Loaded from DB')
          } else {
            setStatus('New Document')
          }
        } catch (e) {
          console.error('Yjs Decoding Error:', e)
          setStatus('Corrupted data format')
        }
      } else {
        setStatus('New Document')
      }
      doc.off('update', onUpdate)
    }

    initLoad()

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        basicSetup,
        javascript(),
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

    return () => {
      view.destroy()
      provider.destroy()
      saveToDatabase.cancel()
    }
  }, [documentId, supabase])

  return (
    <div>
      <div style={{ marginBottom: '10px', color: '#888', fontSize: '0.9em' }}>
        Status: {status}
      </div>
      <div 
        ref={editorRef} 
        style={{ border: '1px solid #ccc', minHeight: '400px', textAlign: 'left' }} 
      />
    </div>
  )
}