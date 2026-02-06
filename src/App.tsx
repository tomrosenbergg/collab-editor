import { createClient } from '@supabase/supabase-js'
import { CollaborativeEditor } from './CollaborativeEditor'
import './App.css'

// REPLACE THESE WITH YOUR KEYS




const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
  realtime: {
    params: {
      eventsPerSecond: 10,
    }
  }
}
)

function App() {
  return (
    <div className="App">
      {/* We are connecting to the document with ID 'doc-1' */}
      <CollaborativeEditor documentId="doc-1" supabase={supabase} />
    </div>
  )
}

export default App