import { useState, useEffect } from 'react'
import { createClient, type Session } from '@supabase/supabase-js'
import { CollaborativeEditor } from './CollaborativeEditor'
import { Auth } from './Auth'
import { Dashboard } from './Dashboard'
import { Menu } from './Menu' // <--- IMPORT ADDED
import './App.css'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { realtime: { params: { eventsPerSecond: 10 } } }
)

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [currentDocId, setCurrentDocId] = useState<string | null>(null)
  const [showDashboard, setShowDashboard] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) setShowDashboard(true) 
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) {
        setCurrentDocId(null)
        setShowDashboard(false)
      } else {
        if (!currentDocId) setShowDashboard(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [currentDocId])

  // REMOVED: Inline Menu component definition was here

  if (!session) {
    return <Auth supabase={supabase} />
  }

  return (
    <div className="App">
      {/* Stable Menu Component */}
      <Menu onOpenDashboard={() => setShowDashboard(true)} />

      {/* Editor - Key forces remount when doc changes */}
      {currentDocId ? (
        <CollaborativeEditor 
          key={currentDocId} 
          documentId={currentDocId} 
          supabase={supabase} 
        />
      ) : (
        <div style={{ 
          height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' 
        }}>
          No document open
        </div>
      )}

      {/* Dashboard Modal */}
      {showDashboard && (
        <Dashboard 
          supabase={supabase}
          userId={session.user.id}
          onOpenDocument={(id) => {
            setCurrentDocId(id)
            setShowDashboard(false)
          }}
          onClose={() => {
            if (currentDocId) setShowDashboard(false)
          }}
        />
      )}
    </div>
  )
}

export default App