import type { SupabaseClient } from '@supabase/supabase-js'

export const signInWithEmail = (supabase: SupabaseClient, email: string, password: string) => {
  return supabase.auth.signInWithPassword({ email, password })
}

export const signUpWithEmail = (supabase: SupabaseClient, email: string, password: string) => {
  return supabase.auth.signUp({ email, password })
}

export const signInWithGoogle = (supabase: SupabaseClient, redirectTo: string) => {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
}
