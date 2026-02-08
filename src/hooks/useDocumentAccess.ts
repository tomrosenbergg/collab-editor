import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchDocumentMeta, fetchPermissionForUser } from '../data/documents'
import { logger } from '../utils/logger'
import type { Database } from '../types/supabase'

type AccessState = {
  permissionLoaded: boolean
  isReadOnly: boolean
  accessDenied: boolean
  isOwner: boolean
  requiresAuth: boolean
}

export const useDocumentAccess = (
  supabase: SupabaseClient<Database>,
  documentId: string,
  currentUserEmail?: string
) => {
  const [state, setState] = useState<AccessState>({
    permissionLoaded: false,
    isReadOnly: false,
    accessDenied: false,
    isOwner: false,
    requiresAuth: false,
  })

  useEffect(() => {
    let cancelled = false

    const checkAccess = async () => {
      setState((prev) => ({ ...prev, permissionLoaded: false }))
      try {
        const docData = await fetchDocumentMeta(supabase, documentId)

        if (!docData) {
          if (!currentUserEmail) {
            if (!cancelled) {
              setState({
                permissionLoaded: true,
                isReadOnly: false,
                accessDenied: false,
                isOwner: false,
                requiresAuth: true,
              })
            }
          } else {
            if (!cancelled) {
              setState({
                permissionLoaded: true,
                isReadOnly: true,
                accessDenied: true,
                isOwner: false,
                requiresAuth: false,
              })
            }
          }
          return
        }

        const userId = (await supabase.auth.getUser()).data.user?.id
        if (docData.owner_id === userId) {
          if (!cancelled) {
            setState({
              permissionLoaded: true,
              isReadOnly: false,
              accessDenied: false,
              isOwner: true,
              requiresAuth: false,
            })
          }
          return
        }

        if (docData.is_public && docData.public_permission === 'editor') {
          if (!cancelled) {
            setState({
              permissionLoaded: true,
              isReadOnly: false,
              accessDenied: false,
              isOwner: false,
              requiresAuth: false,
            })
          }
          return
        }

        if (!currentUserEmail) {
          if (!cancelled) {
            setState({
              permissionLoaded: true,
              isReadOnly: true,
              accessDenied: false,
              isOwner: false,
              requiresAuth: false,
            })
          }
          return
        }

        const perm = await fetchPermissionForUser(supabase, documentId, currentUserEmail)
        if (!cancelled) {
          setState({
            permissionLoaded: true,
            isReadOnly: perm?.permission_level !== 'editor',
            accessDenied: false,
            isOwner: false,
            requiresAuth: false,
          })
        }
      } catch (error) {
        logger.error('Failed to check document access', { documentId, error })
        if (!cancelled) {
          setState({
            permissionLoaded: true,
            isReadOnly: true,
            accessDenied: true,
            isOwner: false,
            requiresAuth: false,
          })
        }
      }
    }

    checkAccess()
    return () => {
      cancelled = true
    }
  }, [supabase, documentId, currentUserEmail])

  return state
}
