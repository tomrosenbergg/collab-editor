// src/hooks/useYjsPersistence.ts
import { useState, useCallback } from 'react'
import * as Y from 'yjs'
import { SupabaseClient } from '@supabase/supabase-js'
import debounce from 'lodash/debounce'

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

export const useYjsPersistence = (supabase: SupabaseClient, doc: Y.Doc) => {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // 1. Robust Hex String Parser for Postgres 'bytea'
  const parsePostgresHex = (hexContent: string): Uint8Array => {
    // Remove '\x' prefix if present (Postgres standard)
    const cleanHex = hexContent.startsWith('\\x') ? hexContent.slice(2) : hexContent
    
    // Safety check for valid hex
    if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
      throw new Error('Invalid Hex String from Database')
    }

    // Convert hex pairs to integers
    const match = cleanHex.match(/.{1,2}/g)
    if (!match) return new Uint8Array([])
    
    return new Uint8Array(match.map((byte) => parseInt(byte, 16)))
  }

  // 2. Load Initial State (Optimistic)
  const loadDocument = useCallback(async (documentId: string) => {
    setStatus('loading')
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('content')
        .eq('id', documentId)
        .maybeSingle()

      if (error) throw error

      if (data?.content) {
        // Apply DB state immediately
        const update = parsePostgresHex(data.content)
        if (update.length > 0) {
          Y.applyUpdate(doc, update, 'db-load')
        }
      } else {
        console.log('New Document created')
      }
      setStatus('saved')
    } catch (e) {
      console.error('Failed to load document:', e)
      setStatus('error')
    }
  }, [supabase, doc])

  // 3. Debounced Save Function
  const saveDocument = useCallback(
    debounce(async (documentId: string) => {
      setStatus('saving')
      
      try {
        const state = Y.encodeStateAsUpdate(doc)
        
        // Convert to Postgres HEX format (\x...)
        const hex = Array.from(state)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
        
        const payload = `\\x${hex}`

        const { error } = await supabase
          .from('documents')
          .upsert({ id: documentId, content: payload })

        if (error) throw error
        
        setLastSaved(new Date())
        setStatus('saved')
      } catch (e) {
        console.error('Failed to save document:', e)
        setStatus('error')
      }
    }, 2000), // 2 second debounce
    [supabase, doc]
  )

  return { status, lastSaved, loadDocument, saveDocument }
}