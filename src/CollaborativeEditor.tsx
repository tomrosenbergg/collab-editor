import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseProvider } from './SupabaseProvider'
import { useYjsPersistence } from './hooks/useYjsPersistence'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { getEditorExtensions } from './editor/getEditorExtensions'
import { fetchDocumentMeta, fetchPermissionForUser } from './data/documents'

interface Props {
  documentId: string
  supabase: SupabaseClient
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
  const { status, loadDocument, saveDocument, cancelSave } = useYjsPersistence(supabase, doc)
  
  const [permissionLoaded, setPermissionLoaded] = useState(false)
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)

  // 1. Check Permissions
  useEffect(() => {
    const checkAccess = async () => {
      setPermissionLoaded(false)
      
      // A. Fetch Document Metadata
      // We explicitly select 'public_permission' to see if anonymous users can edit
      let docData: Awaited<ReturnType<typeof fetchDocumentMeta>> = null
      try {
        docData = await fetchDocumentMeta(supabase, documentId)
      } catch {
        docData = null
      }

      // B. Handle Missing Data (RLS Hidden or Deleted)
      if (!docData) {
        if (!currentUserEmail) {
          // If anonymous and we can't see it, it might be private. Bounce to login.
          onAuthRequired() 
        } else {
          // If logged in and can't see it, it's truly restricted or deleted.
          setAccessDenied(true)
          setPermissionLoaded(true)
        }
        return
      }

      // C. Check Ownership (Always Read-Write)
      const userId = (await supabase.auth.getUser()).data.user?.id
      if (docData.owner_id === userId) {
        setIsReadOnly(false)
        onSetIsOwner(true)
        setPermissionLoaded(true)
        return
      }
      onSetIsOwner(false)

      // D. Check Public Editor Status
      // If the doc is public AND allows public editing, grant access immediately.
      // This applies to both Anonymous and Logged-in users.
      if (docData.is_public && docData.public_permission === 'editor') {
        setIsReadOnly(false)
        setPermissionLoaded(true)
        return
      }

      // E. Check Anonymous Viewer
      if (!currentUserEmail) {
        // If we reached here: It's public (visible), but NOT a public editor.
        // Therefore, it must be Read-Only.
        setIsReadOnly(true)
        setPermissionLoaded(true)
        return
      }

      // F. Check Explicit Permissions (For Logged In Users)
      // Even if public is "Viewer", a specific user might be invited as "Editor".
      const perm = await fetchPermissionForUser(supabase, documentId, currentUserEmail)

      if (perm?.permission_level) {
        setIsReadOnly(perm.permission_level === 'viewer')
      } else {
        // Not explicitly invited.
        // Fallback to Public Status (Viewer) because RLS allowed us to see the docData.
        setIsReadOnly(true) 
      }
      
      setPermissionLoaded(true)
    }
    
    checkAccess()
  }, [documentId, currentUserEmail])


  // 2. Persist local changes only
  useEffect(() => {
    if (!permissionLoaded || accessDenied) return

    const handleUpdate = (_update: Uint8Array, origin: unknown) => {
      if (isReadOnly) return
      if (origin === 'remote' || origin === 'db-load') return
      saveDocument(documentId)
    }

    doc.on('update', handleUpdate)
    return () => {
      doc.off('update', handleUpdate)
      cancelSave()
    }
  }, [doc, documentId, isReadOnly, permissionLoaded, accessDenied, saveDocument, cancelSave])

  // 3. Initialize Editor
  useEffect(() => {
    if (!permissionLoaded || accessDenied) return; 

    const provider = new SupabaseProvider(doc, supabase, documentId)
    const ytext = doc.getText('codemirror')

    // Set User Awareness Color/Name
    provider.awareness.setLocalStateField('user', {
      name: currentUserEmail?.split('@')[0] || 'Anonymous',
      color: '#30bced', // You could randomize this per user
    })

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: getEditorExtensions({
        isReadOnly,
        ytext,
        awareness: provider.awareness,
      }),
    })

    const view = new EditorView({ state, parent: editorRef.current! })

    // Load initial content
    loadDocument(documentId)

    return () => {
      view.destroy()
      provider.destroy()
    }
  }, [documentId, supabase, doc, permissionLoaded, isReadOnly, accessDenied])

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

  if (!permissionLoaded) {
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
