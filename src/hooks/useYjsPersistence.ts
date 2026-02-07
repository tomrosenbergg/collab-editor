import { useState, useCallback, useRef } from 'react'
import * as Y from 'yjs'
import { SupabaseClient } from '@supabase/supabase-js'
import debounce from 'lodash/debounce'

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

export const useYjsPersistence = (supabase: SupabaseClient, doc: Y.Doc) => {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const isLoaded = useRef(false)
  
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
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('content')
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
      isLoaded.current = true
      setStatus('saved')
    } catch (e) {
      console.error('Failed to load document:', e)
      setStatus('error')
    }
  }, [supabase, doc])

  const saveDocument = useCallback(
    debounce(async (documentId: string) => {
      if (!isLoaded.current) return 

      setStatus('saving')
      try {
        const state = Y.encodeStateAsUpdate(doc)
        
        // Convert to HEX for Postgres bytea
        const hex = Array.from(state)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
        
        // We only update content and timestamp
        const { error } = await supabase
          .from('documents')
          .update({ 
            content: `\\x${hex}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', documentId)

        if (error) throw error
        
        setStatus('saved')
      } catch (e) {
        console.error('Failed to save document:', e)
        setStatus('error')
      }
    }, 2000), 
    [supabase, doc]
  )

  return { status, loadDocument, saveDocument }
}