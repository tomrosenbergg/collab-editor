import { useEffect, useState } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import type { Screenplay } from './types'
import { createDocument, deleteDocument, fetchDocuments, updateDocumentTitle } from './data/documents'
import { useToast } from './ui/Toast'

interface Props {
  supabase: SupabaseClient
  userId: string
  onOpenDocument: (id: string) => void
  onShare: (docId: string) => void
  onClose: () => void
}

export const Dashboard = ({ supabase, userId, onOpenDocument, onShare, onClose }: Props) => {
  // Use Screenplay[] here
  const [docs, setDocs] = useState<Screenplay[]>([]) 
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const { addToast } = useToast()

  useEffect(() => {
    fetchDocs()
  }, [])

  const fetchDocs = async () => {
    try {
      const data = await fetchDocuments(supabase)
      setDocs(data)
    } catch {
      setDocs([])
      addToast('Failed to load documents.', 'error')
    }
    setLoading(false)
  }

  // ... rest of the file remains exactly the same ...
  // (Just make sure the logic below uses 'doc' or 'docs' variables normally)

  const createDoc = async () => {
    if (!newTitle.trim()) return
    try {
      const data = await createDocument(supabase, newTitle, userId)
      onOpenDocument(data.id)
    } catch {
      addToast('Failed to create document.', 'error')
    }
  }

  const deleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure?')) return
    try {
      await deleteDocument(supabase, id)
      fetchDocs()
    } catch {
      addToast('Failed to delete document.', 'error')
    }
  }

  const startRenaming = (e: React.MouseEvent, doc: Screenplay) => { // <--- CHANGED
    e.stopPropagation()
    if (doc.owner_id !== userId) return
    setEditingId(doc.id)
    setEditTitle(doc.title)
  }

  const saveTitle = async (id: string) => {
    if (!editTitle.trim()) return
    try {
      await updateDocumentTitle(supabase, id, editTitle)
      setEditingId(null)
      fetchDocs()
    } catch {
      addToast('Failed to rename document.', 'error')
    }
  }

  return (
    <div className="dashboard-overlay">
      <div className="dashboard-modal dashboard-docs ui-card">
        <div className="dashboard-header docs-header">
          <div>
            <h2>My Screenplays</h2>
            <p className="docs-subtitle">Recent files and shared projects</p>
          </div>
          <div className="docs-actions">
            <button onClick={createDoc} className="docs-primary-btn ui-btn ui-btn-primary">New</button>
            <button onClick={onClose} className="docs-close ui-btn ui-btn-ghost">Close</button>
          </div>
        </div>

        <div className="docs-toolbar">
          <div className="docs-search">
            <input 
              className="docs-search-input ui-input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="New screenplay title..."
              onKeyDown={(e) => e.key === 'Enter' && createDoc()}
            />
            <button onClick={createDoc} className="docs-create-btn ui-btn">Create</button>
          </div>
        </div>

        {loading ? <p className="docs-loading">Loading...</p> : (
          <div className="docs-list">
            {docs.map(doc => (
              <div 
                key={doc.id} 
                className="docs-row"
                onClick={() => onOpenDocument(doc.id)}
              >
                <div className="docs-file">
                  <div className="docs-file-icon">📄</div>
                  <div className="docs-file-meta">
                    {editingId === doc.id ? (
                      <input 
                        autoFocus
                        className="docs-rename-input ui-input"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={() => saveTitle(doc.id)}
                        onKeyDown={e => e.key === 'Enter' && saveTitle(doc.id)}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <div 
                        className="docs-file-title" 
                        title={doc.owner_id === userId ? "Double click to rename" : "Shared with you"}
                        onDoubleClick={(e) => startRenaming(e, doc)}
                      >
                        {doc.title} 
                        {doc.owner_id !== userId && <span className="docs-shared">(Shared)</span>}
                      </div>
                    )}
                    <div className="docs-file-date">
                      {new Date(doc.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="docs-row-actions">
                  {doc.owner_id === userId && (
                    <button 
                      className="docs-link-btn ui-btn-text"
                      onClick={(e) => { e.stopPropagation(); onShare(doc.id); }}
                      title="Share"
                    >
                      Share
                    </button>
                  )}
                  {doc.owner_id === userId && (
                    <button 
                      className="docs-icon-btn"
                      onClick={(e) => deleteDoc(doc.id, e)}
                      title="Delete"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
            {docs.length === 0 && <p className="dashboard-empty">No scripts found.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
