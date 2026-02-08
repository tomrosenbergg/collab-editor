import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { SupabaseClient } from '@supabase/supabase-js'
import { useYjsPersistence } from './hooks/useYjsPersistence'
import { useDocumentAccess } from './hooks/useDocumentAccess'
import { useEditorSetup } from './editor/useEditorSetup'
import type { Database } from './types/supabase'

interface Props {
  documentId: string
  supabase: SupabaseClient<Database>
  currentUserEmail: string | undefined
  onSetIsOwner: (isOwner: boolean) => void
  onAuthRequired: () => void
}

export const CollaborativeEditor = ({ 
  documentId, 
  supabase, 
  currentUserEmail, 
  onSetIsOwner, 
  onAuthRequired 
}: Props) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const [doc] = useState(() => new Y.Doc())
  const { status, loadDocument, saveUpdate, cancelSave } = useYjsPersistence(supabase, doc)
  
  const { permissionLoaded, isReadOnly, accessDenied, isOwner, requiresAuth } = useDocumentAccess(
    supabase,
    documentId,
    currentUserEmail
  )

  useEffect(() => {
    if (requiresAuth) {
      onAuthRequired()
    }
  }, [requiresAuth, onAuthRequired])

  useEffect(() => {
    onSetIsOwner(isOwner)
  }, [isOwner, onSetIsOwner])


  // 2. Persist local changes only
  useEffect(() => {
    if (!permissionLoaded || accessDenied) return

    const handleUpdate = (update: Uint8Array, origin: unknown) => {
      if (isReadOnly) return
      if (origin === 'remote' || origin === 'db-load') return
      saveUpdate(documentId, update)
    }

    doc.on('update', handleUpdate)
    return () => {
      doc.off('update', handleUpdate)
      cancelSave()
    }
  }, [doc, documentId, isReadOnly, permissionLoaded, accessDenied, saveUpdate, cancelSave])

  useEditorSetup({
    editorRef,
    doc,
    supabase,
    documentId,
    currentUserEmail,
    isReadOnly,
    permissionLoaded,
    accessDenied: accessDenied || requiresAuth,
    loadDocument,
  })

  // --- Render States ---

  if (accessDenied) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
        <h2 style={{color: '#e0e0e0'}}>Access Denied</h2>
        <p style={{color: '#888'}}>You do not have permission to view this screenplay.</p>
        <a href="/" style={{color: '#30bced'}}>Back to Home</a>
      </div>
    )
  }

  if (!permissionLoaded || requiresAuth) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
        Loading screenplay...
      </div>
    )
  }

  return (
    <>
      <div ref={editorRef} style={{ width: '100%', height: '100vh', outline: 'none' }} />
      
      {/* Status Indicator */}
      <div style={{
        position: 'fixed', bottom: 20, right: 20,
        color: '#666', fontFamily: 'sans-serif', fontSize: '12px', pointerEvents: 'none'
      }}>
        {isReadOnly ? "Read Only" : (
           <>
            {status === 'loading' && 'Loading...'}
            {status === 'saving' && 'Saving...'}
            {status === 'saved' && 'Saved'}
            {status === 'error' && 'Sync Error'}
           </>
        )}
      </div>
    </>
  )
}
