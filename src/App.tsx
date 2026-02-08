import { useState, useEffect } from 'react'
import { createClient, type Session } from '@supabase/supabase-js'
import { CollaborativeEditor } from './CollaborativeEditor'
import { Auth } from './Auth'
import { Dashboard } from './Dashboard'
import { Menu } from './Menu'
import { ShareModal } from './ShareModal'
import { ErrorBoundary } from './ui/ErrorBoundary'
import './App.css'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'
import type { Database } from './types/supabase'

const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  { realtime: { params: { eventsPerSecond: 10 } } }
)

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [currentDocId, setCurrentDocId] = useState<string | null>(null)
  
  // UI States
  const [showDashboard, setShowDashboard] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [shareDocId, setShareDocId] = useState<string | null>(null)
  const [isCurrentDocOwner, setIsCurrentDocOwner] = useState(false)
  
  // New State: If true, we force the Login screen even if a docId exists
  const [authRequired, setAuthRequired] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      
      const params = new URLSearchParams(window.location.search)
      const urlDocId = params.get('id')
      
      if (urlDocId) {
        setCurrentDocId(urlDocId)
      } else if (session) {
        setShowDashboard(true)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) {
        // Only clear doc if we aren't trying to view a public link
        // We leave currentDocId alone so they can log back in and see it
        setAuthRequired(false) // Reset this on logout
      } else {
        // If we just logged in, remove the "Auth Required" block
        setAuthRequired(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const openDocument = (id: string) => {
    setCurrentDocId(id)
    setShowDashboard(false)
    const newUrl = `${window.location.pathname}?id=${id}`
    window.history.pushState({ path: newUrl }, '', newUrl)
  }

  const handleOpenShare = (docId: string) => {
    setShareDocId(docId)
    setShowShare(true)
  }

  // LOGIC: Show Auth if:
  // 1. We are explicitly told to (authRequired)
  // 2. OR we have no session AND no document to try and load
  const showAuthScreen = authRequired || (!session && !currentDocId)

  if (showAuthScreen) {
    return (
      <>
        {/* Optional: Add a little banner explaining why they are here */}
        {authRequired && (
          <div style={{
            position: 'absolute', top: 0, width: '100%', 
            background: '#ee6352', color: 'white', textAlign: 'center', padding: '10px',
            fontSize: '0.9rem'
          }}>
            This document is private. Please log in to view.
          </div>
        )}
        <Auth supabase={supabase} />
      </>
    )
  }

  return (
    <div className="App">
      {/* Menu */}
      {session && currentDocId && (
        <Menu 
          onOpenDashboard={() => setShowDashboard(true)} 
          onShare={() => handleOpenShare(currentDocId)}
          isOwner={isCurrentDocOwner}
        />
      )}

      {/* Editor */}
      {currentDocId ? (
        <ErrorBoundary>
          <CollaborativeEditor 
            key={currentDocId} 
            documentId={currentDocId} 
            supabase={supabase} 
            currentUserEmail={session?.user?.email}
            onSetIsOwner={setIsCurrentDocOwner}
            onAuthRequired={() => setAuthRequired(true)} // <--- TRIGGER LOGIN
          />
        </ErrorBoundary>
      ) : (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
           <button 
             onClick={() => setShowDashboard(true)}
             className="dashboard-create-btn"
          >
            Open Dashboard
          </button>
        </div>
      )}

      {/* Dashboard Modal */}
      {session && showDashboard && (
        <Dashboard 
          supabase={supabase}
          userId={session.user.id}
          onOpenDocument={openDocument}
          onShare={handleOpenShare}
          onClose={() => {
            if (currentDocId) setShowDashboard(false)
          }}
        />
      )}

      {/* Share Modal */}
      {session && showShare && shareDocId && (
        <ShareModal
          supabase={supabase}
          documentId={shareDocId}
          currentUserEmail={session.user.email}
          onClose={() => {
            setShowShare(false)
            setShareDocId(null)
          }}
        />
      )}
    </div>
  )
}

export default App
