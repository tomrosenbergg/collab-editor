import { useEffect, useState } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'

interface Document {
  id: string
  title: string
  updated_at: string
}

interface Props {
  supabase: SupabaseClient
  userId: string
  onOpenDocument: (id: string) => void
  onClose: () => void
}

export const Dashboard = ({ supabase, userId, onOpenDocument, onClose }: Props) => {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => {
    fetchDocs()
  }, [])

  const fetchDocs = async () => {
    const { data } = await supabase
      .from('documents')
      .select('id, title, updated_at')
      .order('updated_at', { ascending: false })
    if (data) setDocs(data)
    setLoading(false)
  }

  const createDoc = async () => {
    if (!newTitle.trim()) return
    const { data, error } = await supabase
      .from('documents')
      .insert({ title: newTitle, owner_id: userId, content: '' }) // Init empty
      .select()
      .single()
    
    if (data) {
      onOpenDocument(data.id)
    } else if (error) {
      console.error(error)
    }
  }

  const deleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this screenplay?')) return
    await supabase.from('documents').delete().eq('id', id)
    fetchDocs()
  }

  return (
    <div className="dashboard-overlay">
      <div className="dashboard-modal">
        {/* Header */}
        <div className="dashboard-header">
          <h2>My Screenplays</h2>
          <button onClick={onClose} className="dashboard-close">Close</button>
        </div>

        {/* Create New Document Bar */}
        <div className="dashboard-create-row">
          <input 
            className="dashboard-input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New Screenplay Title..."
            onKeyDown={(e) => e.key === 'Enter' && createDoc()}
          />
          <button onClick={createDoc} className="dashboard-create-btn">
            Create
          </button>
        </div>

        {/* Document List */}
        {loading ? <p style={{ color: '#666' }}>Loading...</p> : (
          <div className="dashboard-list">
            {docs.map(doc => (
              <div 
                key={doc.id} 
                className="dashboard-item"
                onClick={() => onOpenDocument(doc.id)}
              >
                <div className="item-meta">
                  <div className="item-title">{doc.title}</div>
                  <div className="item-date">
                    {new Date(doc.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <button 
                  className="item-delete-btn"
                  onClick={(e) => deleteDoc(doc.id, e)}
                  title="Delete Screenplay"
                >
                  ×
                </button>
              </div>
            ))}
            
            {docs.length === 0 && (
              <p className="dashboard-empty">No scripts found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}