import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import * as Y from 'yjs'
import { SupabaseClient } from '@supabase/supabase-js'
import debounce from 'lodash/debounce'
import type { Database } from '../types/supabase'
import { logger } from '../utils/logger'

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

export const useYjsPersistence = (supabase: SupabaseClient<Database>, doc: Y.Doc) => {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const isLoaded = useRef(false)
  const pendingUpdates = useRef<Uint8Array[]>([])
  const updatesSinceCompact = useRef(0)
  const lastCompactAt = useRef<number>(Date.now())
  const currentDocumentIdRef = useRef<string>('')
  
  // Parse Postgres HEX format (\x0123...)
  const parsePostgresHex = (hexContent: string): Uint8Array => {
    // Handle bytea format
    const cleanHex = hexContent.startsWith('\\x') ? hexContent.slice(2) : hexContent
    if (!/^[0-9a-fA-F]*$/.test(cleanHex)) return new Uint8Array([])
    const match = cleanHex.match(/.{1,2}/g)
    if (!match) return new Uint8Array([])
    return new Uint8Array(match.map((byte) => parseInt(byte, 16)))
  }

  const loadDocument = useCallback(async (documentId: string) => {
    setStatus('loading')
    isLoaded.current = false // Reset loaded state
    currentDocumentIdRef.current = documentId
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('content, snapshot_at')
        .eq('id', documentId)
        .maybeSingle()

      if (error) throw error

      if (data?.content) {
        // Handle both string format (from DB) or potential raw bytes
        const contentStr = typeof data.content === 'string' ? data.content : ''
        const update = parsePostgresHex(contentStr)
        
        if (update.length > 0) {
          Y.applyUpdate(doc, update, 'db-load')
        }
      }

      const snapshotAt = data?.snapshot_at ?? null
      let updatesQuery = supabase
        .from('document_updates')
        .select('update, created_at')
        .eq('document_id', documentId)
        .order('created_at', { ascending: true })

      if (snapshotAt) {
        updatesQuery = updatesQuery.gt('created_at', snapshotAt)
      }

      const { data: updates, error: updatesError } = await updatesQuery
      if (updatesError) throw updatesError

      if (updates) {
        for (const row of updates) {
          const updateStr = typeof row.update === 'string' ? row.update : ''
          const updateBytes = parsePostgresHex(updateStr)
          if (updateBytes.length > 0) {
            Y.applyUpdate(doc, updateBytes, 'db-load')
          }
        }
      }
      isLoaded.current = true
      setStatus('saved')
    } catch (e) {
      logger.error('Failed to load document', { error: e })
      setStatus('error')
    }
  }, [supabase, doc])

  const compactUpdates = useCallback(
    async (documentId: string) => {
      const snapshot = Y.encodeStateAsUpdate(doc)
      const snapshotHex = Array.from(snapshot)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      const { error: compactError } = await supabase.rpc('compact_document_updates', {
        p_document_id: documentId,
        p_content_hex: snapshotHex,
      })
      if (!compactError) {
        updatesSinceCompact.current = 0
        lastCompactAt.current = Date.now()
      }
    },
    [supabase, doc]
  )

  const flushUpdates = useMemo(
    () =>
      debounce(async (documentId: string) => {
        if (!isLoaded.current) return
        if (pendingUpdates.current.length === 0) return

        setStatus('saving')
        try {
          const merged = Y.mergeUpdates(pendingUpdates.current)
          pendingUpdates.current = []

          const hex = Array.from(merged)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')

          const { error } = await supabase.rpc('append_document_update', {
            p_document_id: documentId,
            p_update_hex: hex,
          })

          if (error) throw error

          updatesSinceCompact.current += 1
          if (updatesSinceCompact.current >= 50) {
            await compactUpdates(documentId)
          }

          setStatus('saved')
        } catch (e) {
          logger.error('Failed to append document update', { error: e })
          setStatus('error')
        }
      }, 500),
    [supabase, doc, compactUpdates]
  )

  const saveUpdate = useCallback(
    (documentId: string, update: Uint8Array) => {
      currentDocumentIdRef.current = documentId
      pendingUpdates.current.push(update)
      flushUpdates(documentId)
    },
    [flushUpdates]
  )

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoaded.current) return
      if (!currentDocumentIdRef.current) return
      if (updatesSinceCompact.current === 0) return
      const ageMs = Date.now() - lastCompactAt.current
      if (ageMs < 2 * 60 * 1000) return
      // Fire-and-forget compaction to keep the update log bounded.
      compactUpdates(currentDocumentIdRef.current)
    }, 60 * 1000)

    return () => clearInterval(interval)
  }, [compactUpdates])

  return { status, loadDocument, saveUpdate, cancelSave: flushUpdates.cancel }
}
