import { useState } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'

interface Props {
  supabase: SupabaseClient
}

export const Auth = ({ supabase }: Props) => {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [msg, setMsg] = useState('')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('Check your email for the login link!')
      }
    } catch (error: any) {
      setMsg(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', alignItems: 'center', 
      justifyContent: 'center', height: '100vh', color: '#e0e0e0', fontFamily: 'sans-serif' 
    }}>
      <h1 style={{ fontFamily: 'Courier Prime, monospace' }}>Screenplay Editor</h1>
      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '300px' }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: '10px', background: '#333', border: 'none', color: 'white' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '10px', background: '#333', border: 'none', color: 'white' }}
        />
        <button type="submit" disabled={loading} style={{ 
          padding: '10px', cursor: 'pointer', background: '#30bced', border: 'none', color: 'black', fontWeight: 'bold' 
        }}>
          {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
        </button>
      </form>
      <p style={{ marginTop: '1rem', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem' }} 
         onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? "Need an account? Sign Up" : "Have an account? Log In"}
      </p>
      {msg && <p style={{ color: '#ffbc42', marginTop: '1rem' }}>{msg}</p>}
    </div>
  )
}