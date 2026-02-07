import { useState, useCallback, useRef } from 'react'
import * as Y from 'yjs'
import { SupabaseClient } from '@supabase/supabase-js'
import debounce from 'lodash/debounce'

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

export const useYjsPersistence = (supabase: SupabaseClient, doc: Y.Doc) => {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const isLoaded = useRef(false)

  // 1. Robust Hex String Parser for Postgres 'bytea'
  const parsePostgresHex = (hexContent: string): Uint8Array => {
    const cleanHex = hexContent.startsWith('\\x') ? hexContent.slice(2) : hexContent
    if (!/^[0-9a-fA-F]*$/.test(cleanHex)) throw new Error('Invalid Hex String')
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
        const update = parsePostgresHex(data.content)
        if (update.length > 0) {
          Y.applyUpdate(doc, update, 'db-load')
        }
      }
      isLoaded.current = true
      setStatus('saved')
    } catch (e) {
      console.error('Failed to load document:', e)
      setStatus('error')
    }
  }, [supabase, doc])

  // 3. Debounced Save
  const saveDocument = useCallback(
    debounce(async (documentId: string) => {
      // Prevent saving if we haven't finished loading the initial state
      if (!isLoaded.current) return 

      setStatus('saving')
      try {
        const state = Y.encodeStateAsUpdate(doc)
        const hex = Array.from(state)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
        
        const { error } = await supabase
          .from('documents')
          .upsert({ id: documentId, content: `\\x${hex}` })

        if (error) throw error
        
        setLastSaved(new Date())
        setStatus('saved')
      } catch (e) {
        console.error('Failed to save document:', e)
        setStatus('error')
      }
    }, 2000),
    [supabase, doc]
  )

  return { status, lastSaved, loadDocument, saveDocument }
}