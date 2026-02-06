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

    const userColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]
    provider.awareness.setLocalStateField('user', {
      name: 'User ' + Math.floor(Math.random() * 100),
      color: userColor,
    })

    // Persist full binary state to DB
    const saveToDatabase = debounce(() => {
      provider.saveStateToSupabase(supabase, documentId)
        .then(({ error }) => {
          if (!error) console.log('Binary state saved')
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
  await new Promise(resolve => setTimeout(resolve, 2000));

  if (receivedPeerData || ytext.toString().length > 0) {
    doc.off('update', onUpdate);
    return;
  }

  setStatus('Loading from DB...');
  const { data, error } = await supabase
    .from('documents')
    .select('content')
    .eq('id', documentId)
    .single();

  if (error) {
    console.error('Fetch Error:', error);
    setStatus('Error loading document');
  } else if (data?.content) {
    try {
      // Ensure the data is wrapped in a Uint8Array
      const binaryUpdate = new Uint8Array(data.content);
      
      // Safety check: Don't apply if the array is empty or too small
      if (binaryUpdate.length > 0) {
        Y.applyUpdate(doc, binaryUpdate, 'initial-db-load');
        setStatus('Loaded from DB');
      } else {
        setStatus('New Document');
      }
    } catch (e) {
      console.error('Yjs Decoding Error:', e);
      setStatus('Corrupted document state');
    }
  } else {
    setStatus('New Document');
  }
  doc.off('update', onUpdate);
};

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