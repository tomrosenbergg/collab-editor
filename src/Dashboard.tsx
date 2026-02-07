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
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid #444', padding: '2rem',
        width: '500px', maxHeight: '80vh', overflowY: 'auto', borderRadius: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <h2 style={{ margin: 0 }}>My Screenplays</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>Close</button>
        </div>

        {/* Create New */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem' }}>
          <input 
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New Screenplay Title..."
            style={{ flex: 1, padding: '8px', background: '#333', border: 'none', color: 'white' }}
          />
          <button onClick={createDoc} style={{ padding: '8px 16px', background: '#30bced', border: 'none', cursor: 'pointer' }}>
            Create
          </button>
        </div>

        {/* List */}
        {loading ? <p>Loading...</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {docs.map(doc => (
              <div 
                key={doc.id} 
                onClick={() => onOpenDocument(doc.id)}
                style={{
                  padding: '15px', background: '#222', border: '1px solid #333',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#555'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#333'}
              >
                <div>
                  <div style={{ fontWeight: 'bold' }}>{doc.title}</div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    {new Date(doc.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <button 
                  onClick={(e) => deleteDoc(doc.id, e)}
                  style={{ color: '#ee6352', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                >
                  ×
                </button>
              </div>
            ))}
            {docs.length === 0 && <p style={{ color: '#666' }}>No scripts found.</p>}
          </div>
        )}
      </div>
    </div>
  )
}