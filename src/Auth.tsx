import { useState } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from './data/auth'
import type { Database } from './types/supabase'

interface Props {
  supabase: SupabaseClient<Database>
}

export const Auth = ({ supabase }: Props) => {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [msg, setMsg] = useState('')

  const handleGoogle = async () => {
    setLoading(true)
    setMsg('')
    try {
      const { error } = await signInWithGoogle(supabase, window.location.origin)
      if (error) throw error
    } catch (error: any) {
      setMsg(error.message)
      setLoading(false)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    try {
      if (isLogin) {
        const { error } = await signInWithEmail(supabase, email, password)
        if (error) throw error
      } else {
        const { error } = await signUpWithEmail(supabase, email, password)
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
    <div className="auth-shell">
      <header className="auth-nav">
        <div className="auth-logo">ArcScript</div>
        <button className="auth-nav-btn" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Sign Up' : 'Log In'}
        </button>
      </header>

      <main className="auth-hero">
        <div className="auth-hero-copy">
          <p className="auth-kicker">Collaborative Screenwriting</p>
          <h1 className="auth-title">A modern, focused space for screenplays.</h1>
          <p className="auth-subtitle">
            Write in Fountain with live formatting, share instantly, and collaborate in real time.
          </p>
          <div className="auth-hero-actions">
            <button className="auth-primary" onClick={() => setIsLogin(true)}>
              Start writing
            </button>
            <button className="auth-secondary" onClick={() => setIsLogin(false)}>
              Create account
            </button>
          </div>
          <div className="auth-trust">
            Simple, fast, and private by default. Your scripts stay yours.
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-header">
            <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
            <p>Continue with Google or use email.</p>
          </div>

          <button className="auth-google-btn" onClick={handleGoogle} disabled={loading}>
            Continue with Google
          </button>

          <div className="auth-divider"><span>or</span></div>

          <form onSubmit={handleAuth} className="auth-form">
            <input
              className="auth-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="auth-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" disabled={loading} className="auth-button">
              {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
            </button>
          </form>

          <p className="auth-toggle" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Need an account? Sign Up' : 'Have an account? Log In'}
          </p>

          {msg && <p className="auth-error">{msg}</p>}
        </div>
      </main>
    </div>
  )
}
