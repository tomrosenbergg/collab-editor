import * as Y from 'yjs'
import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness'
import type { Database } from './types/supabase'

/**
 * 1. Performance Helpers: Base64 Encoding/Decoding
 * Reduces network payload size by ~30% compared to raw JSON number arrays.
 */
const toBase64 = (bytes: Uint8Array): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('')
  return btoa(binString)
}

const fromBase64 = (str: string): Uint8Array => {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(str, 'base64'))
  }
  const binString = atob(str)
  return Uint8Array.from(binString, (m) => m.codePointAt(0)!)
}

export class SupabaseProvider {
  doc: Y.Doc
  channel: RealtimeChannel
  awareness: Awareness
  private _isConnected: boolean = false
  private _resyncInterval: ReturnType<typeof setInterval> | null = null

  constructor(doc: Y.Doc, supabase: SupabaseClient<Database>, channelId: string) {
    this.doc = doc
    this.awareness = new Awareness(doc)
    this.channel = supabase.channel(channelId)

    this.channel
      // 2. Optimized Listeners: Expect Base64 Strings
      .on('broadcast', { event: 'awareness-update' }, ({ payload }) => {
        // Payload comes in as a Base64 string now
        const update = fromBase64(payload)
        applyAwarenessUpdate(this.awareness, update, 'remote')
      })

      .on('broadcast', { event: 'sync-step-1' }, ({ payload }) => {
        const remoteVector = fromBase64(payload)
        const update = Y.encodeStateAsUpdate(doc, remoteVector)
        if (update.length > 0) {
          this.broadcast('sync-step-2', update)
        }
      })

      .on('broadcast', { event: 'sync-step-2' }, ({ payload }) => {
        const update = fromBase64(payload)
        Y.applyUpdate(doc, update, 'remote')
      })

      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this._isConnected = true
          this.initSync()
        } else {
          this._isConnected = false
        }
      })

    // 3. Local Changes: Encode before Broadcast
    doc.on('update', (update, origin) => {
      if (origin !== 'remote' && origin !== 'db-load' && this._isConnected) {
        this.broadcast('sync-step-2', update)
      }
    })

    this.awareness.on('update', ({ added, updated, removed }) => {
      if (!this._isConnected) return
      const changedClients = added.concat(updated).concat(removed)
      const update = encodeAwarenessUpdate(this.awareness, changedClients)
      this.broadcast('awareness-update', update)
    })

    // Periodic Sync (Keepalive)
    this._resyncInterval = setInterval(() => {
      if (this._isConnected && this.awareness.getStates().size > 0) {
        this.initSync()
      }
    }, 30000)
  }

  private initSync() {
    const vector = Y.encodeStateVector(this.doc)
    this.broadcast('sync-step-1', vector)
  }

  // 4. Optimized Broadcast: Send Base64 String
  private broadcast(event: string, payload: Uint8Array) {
    if (!this._isConnected) return
    
    // Convert Uint8Array -> Base64 String
    const base64Payload = toBase64(payload)

    this.channel.send({
      type: 'broadcast',
      event,
      payload: base64Payload, 
    })
  }

  destroy() {
    if (this._resyncInterval) clearInterval(this._resyncInterval)
    this.channel.unsubscribe()
    this.awareness.destroy()
  }
}
