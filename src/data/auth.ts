import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'

export const signInWithEmail = (supabase: SupabaseClient<Database>, email: string, password: string) => {
  return supabase.auth.signInWithPassword({ email, password })
}

export const signUpWithEmail = (supabase: SupabaseClient<Database>, email: string, password: string) => {
  return supabase.auth.signUp({ email, password })
}

export const signInWithGoogle = (supabase: SupabaseClient<Database>, redirectTo: string) => {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
}
