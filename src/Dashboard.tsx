import { useEffect, useState } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import type { Screenplay } from './types' // <--- ADD 'type' HERE

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

  useEffect(() => {
    fetchDocs()
  }, [])

  const fetchDocs = async () => {
    const { data } = await supabase
      .from('documents')
      .select('id, title, updated_at, owner_id, is_public')
      .order('updated_at', { ascending: false })
    
    if (data) setDocs(data as Screenplay[]) // <--- CHANGED
    setLoading(false)
  }

  // ... rest of the file remains exactly the same ...
  // (Just make sure the logic below uses 'doc' or 'docs' variables normally)

  const createDoc = async () => {
    if (!newTitle.trim()) return
    const { data } = await supabase
      .from('documents')
      .insert({ title: newTitle, owner_id: userId, content: '', is_public: false })
      .select()
      .single()
    
    if (data) onOpenDocument(data.id)
  }

  const deleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure?')) return
    await supabase.from('documents').delete().eq('id', id)
    fetchDocs()
  }

  const startRenaming = (e: React.MouseEvent, doc: Screenplay) => { // <--- CHANGED
    e.stopPropagation()
    if (doc.owner_id !== userId) return
    setEditingId(doc.id)
    setEditTitle(doc.title)
  }

  const saveTitle = async (id: string) => {
    if (!editTitle.trim()) return
    await supabase.from('documents').update({ title: editTitle }).eq('id', id)
    setEditingId(null)
    fetchDocs()
  }

  return (
    <div className="dashboard-overlay">
      <div className="dashboard-modal">
        <div className="dashboard-header">
          <h2>My Screenplays</h2>
          <button onClick={onClose} className="dashboard-close">Close</button>
        </div>

        <div className="dashboard-create-row">
          <input 
            className="dashboard-input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New Screenplay Title..."
            onKeyDown={(e) => e.key === 'Enter' && createDoc()}
          />
          <button onClick={createDoc} className="dashboard-create-btn">Create</button>
        </div>

        {loading ? <p style={{ color: '#666' }}>Loading...</p> : (
          <div className="dashboard-list">
            {docs.map(doc => (
              <div 
                key={doc.id} 
                className="dashboard-item"
                onClick={() => onOpenDocument(doc.id)}
              >
                <div className="item-meta" style={{ flex: 1 }}>
                  {editingId === doc.id ? (
                    <input 
                      autoFocus
                      className="dashboard-input"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onBlur={() => saveTitle(doc.id)}
                      onKeyDown={e => e.key === 'Enter' && saveTitle(doc.id)}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <div 
                      className="item-title" 
                      title={doc.owner_id === userId ? "Double click to rename" : "Shared with you"}
                      onDoubleClick={(e) => startRenaming(e, doc)}
                    >
                      {doc.title} 
                      {doc.owner_id !== userId && <span style={{fontSize:'0.7rem', opacity:0.6, marginLeft: 8}}> (Shared)</span>}
                    </div>
                  )}
                  <div className="item-date">
                    {new Date(doc.updated_at).toLocaleDateString()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {/* Share Button (Only for Owners) */}
                  {doc.owner_id === userId && (
                    <button 
                      className="item-delete-btn"
                      style={{ color: '#30bced', fontSize: '1rem' }}
                      onClick={(e) => { e.stopPropagation(); onShare(doc.id); }}
                      title="Share"
                    >
                      Share
                    </button>
                  )}

                  {/* Delete Button (Only for Owners) */}
                  {doc.owner_id === userId && (
                    <button 
                      className="item-delete-btn"
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