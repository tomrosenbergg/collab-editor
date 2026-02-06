import { createClient } from '@supabase/supabase-js'
import { CollaborativeEditor } from './CollaborativeEditor'
import './App.css'

// REPLACE THESE WITH YOUR KEYS
const SUPABASE_URL = 'https://kktvjaujpqejxiqvopwa.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_mE97Q9kBgo-eulQGtx3HHw_ur0aFNh4'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    // FORCE WebSockets. This prevents Firefox from trying (and failing) 
    // to use HTTP polling or other transports.
    params: {
      eventsPerSecond: 10,
    }
  }
})

function App() {
  return (
    <div className="App">
      <h1>Collaborative Code Editor</h1>
      {/* We are connecting to the document with ID 'doc-1' */}
      <CollaborativeEditor documentId="doc-1" supabase={supabase} />
    </div>
  )
}

export default App