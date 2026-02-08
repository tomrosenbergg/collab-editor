import { useEffect } from 'react'
import * as Y from 'yjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { SupabaseProvider } from '../SupabaseProvider'
import { getEditorExtensions } from './getEditorExtensions'
import type { Database } from '../types/supabase'

interface UseEditorSetupArgs {
  editorRef: React.RefObject<HTMLDivElement>
  doc: Y.Doc
  supabase: SupabaseClient<Database>
  documentId: string
  currentUserEmail?: string
  isReadOnly: boolean
  permissionLoaded: boolean
  accessDenied: boolean
  loadDocument: (documentId: string) => void
}

export const useEditorSetup = ({
  editorRef,
  doc,
  supabase,
  documentId,
  currentUserEmail,
  isReadOnly,
  permissionLoaded,
  accessDenied,
  loadDocument,
}: UseEditorSetupArgs) => {
  useEffect(() => {
    if (!permissionLoaded || accessDenied) return
    if (!editorRef.current) return

    const provider = new SupabaseProvider(doc, supabase, documentId)
    const ytext = doc.getText('codemirror')

    provider.awareness.setLocalStateField('user', {
      name: currentUserEmail?.split('@')[0] || 'Anonymous',
      color: '#30bced',
    })

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: getEditorExtensions({
        isReadOnly,
        ytext,
        awareness: provider.awareness,
      }),
    })

    const view = new EditorView({ state, parent: editorRef.current })

    loadDocument(documentId)

    return () => {
      view.destroy()
      provider.destroy()
    }
  }, [
    editorRef,
    doc,
    supabase,
    documentId,
    currentUserEmail,
    isReadOnly,
    permissionLoaded,
    accessDenied,
    loadDocument,
  ])
}
