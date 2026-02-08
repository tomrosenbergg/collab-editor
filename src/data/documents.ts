import type { SupabaseClient } from '@supabase/supabase-js'
import type { Permission, Screenplay } from '../types'
import { withRetry } from '../utils/retry'
import type { Database } from '../types/supabase'

export const fetchDocuments = async (supabase: SupabaseClient<Database>) => {
  const { data, error } = await withRetry(() =>
    supabase
      .from('documents')
      .select('id, title, updated_at, owner_id, is_public')
      .order('updated_at', { ascending: false })
  )

  if (error) throw error
  return (data ?? []) as Screenplay[]
}

export const createDocument = async (supabase: SupabaseClient<Database>, title: string, ownerId: string) => {
  const { data, error } = await withRetry(() =>
    supabase
      .from('documents')
      .insert({ title, owner_id: ownerId, content: '', is_public: false })
      .select()
      .single()
  )

  if (error) throw error
  return data as Screenplay
}

export const deleteDocument = async (supabase: SupabaseClient<Database>, id: string) => {
  const { error } = await withRetry(() => supabase.from('documents').delete().eq('id', id))
  if (error) throw error
}

export const updateDocumentTitle = async (supabase: SupabaseClient<Database>, id: string, title: string) => {
  const { error } = await withRetry(() => supabase.from('documents').update({ title }).eq('id', id))
  if (error) throw error
}

export const fetchDocumentMeta = async (supabase: SupabaseClient<Database>, id: string) => {
  const { data, error } = await withRetry(() =>
    supabase
      .from('documents')
      .select('owner_id, is_public, public_permission')
      .eq('id', id)
      .maybeSingle()
  )

  if (error) throw error
  return data as Pick<Screenplay, 'owner_id' | 'is_public' | 'public_permission'> | null
}

export const fetchPermissions = async (supabase: SupabaseClient<Database>, documentId: string) => {
  const { data, error } = await withRetry(() =>
    supabase
      .from('document_permissions')
      .select('*')
      .eq('document_id', documentId)
  )

  if (error) throw error
  return (data ?? []) as Permission[]
}

export const fetchPermissionForUser = async (
  supabase: SupabaseClient<Database>,
  documentId: string,
  userEmail: string
) => {
  const { data, error } = await withRetry(() =>
    supabase
      .from('document_permissions')
      .select('permission_level')
      .eq('document_id', documentId)
      .eq('user_email', userEmail)
      .single()
  )

  if (error) return null
  return data as Pick<Permission, 'permission_level'> | null
}

export const setPublicAccess = async (supabase: SupabaseClient<Database>, documentId: string, isPublic: boolean) => {
  const { error } = await withRetry(() =>
    supabase.from('documents').update({ is_public: isPublic }).eq('id', documentId)
  )
  if (error) throw error
}

export const setPublicRole = async (
  supabase: SupabaseClient<Database>,
  documentId: string,
  role: 'viewer' | 'editor'
) => {
  const { error } = await withRetry(() =>
    supabase
      .from('documents')
      .update({ public_permission: role })
      .eq('id', documentId)
  )
  if (error) throw error
}

export const inviteUser = async (
  supabase: SupabaseClient<Database>,
  documentId: string,
  email: string,
  role: 'viewer' | 'editor'
) => {
  const { error } = await withRetry(() =>
    supabase.from('document_permissions').insert({
      document_id: documentId,
      user_email: email,
      permission_level: role,
    })
  )
  if (error) throw error
}

export const updatePermission = async (
  supabase: SupabaseClient<Database>,
  documentId: string,
  email: string,
  role: 'viewer' | 'editor'
) => {
  const { error } = await withRetry(() =>
    supabase
      .from('document_permissions')
      .update({ permission_level: role })
      .eq('document_id', documentId)
      .eq('user_email', email)
  )

  if (error) throw error
}

export const removeUser = async (supabase: SupabaseClient<Database>, documentId: string, email: string) => {
  const { error } = await withRetry(() =>
    supabase
      .from('document_permissions')
      .delete()
      .eq('document_id', documentId)
      .eq('user_email', email)
  )

  if (error) throw error
}
