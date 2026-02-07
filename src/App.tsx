import { useState, useEffect } from 'react'
import { createClient, type Session } from '@supabase/supabase-js'
import { CollaborativeEditor } from './CollaborativeEditor'
import { Auth } from './Auth'
import { Dashboard } from './Dashboard'
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
      if (session) setShowDashboard(true) // Show dashboard on login
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) {
        setCurrentDocId(null)
        setShowDashboard(false)
      } else {
        // If we just logged in and have no doc open, show dashboard
        if (!currentDocId) setShowDashboard(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [currentDocId])

  // Context Menu Implementation (Minimalist)
  const Menu = () => (
    <div style={{ 
      position: 'fixed', top: 20, left: 20, zIndex: 50,
      display: 'flex', gap: '10px'
    }}>
      <button 
        onClick={() => setShowDashboard(true)}
        style={{ 
          background: '#333', color: 'white', border: 'none', padding: '8px 12px', 
          borderRadius: '4px', cursor: 'pointer', opacity: 0.7 
        }}
      >
        ≡ Files
      </button>
      {/* Add Rename or other menu items here if needed */}
    </div>
  )

  if (!session) {
    return <Auth supabase={supabase} />
  }

  return (
    <div className="App">
      {/* Minimal Context Menu */}
      <Menu />

      {/* Editor - Key forces remount when doc changes */}
      {currentDocId ? (
        <CollaborativeEditor 
          key={currentDocId} // CRITICAL: Forces editor to reset when ID changes
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
            // Only allow closing if a document is already open, otherwise keep it open
            if (currentDocId) setShowDashboard(false)
          }}
        />
      )}
    </div>
  )
}

export default App