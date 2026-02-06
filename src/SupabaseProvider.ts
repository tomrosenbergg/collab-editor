import * as Y from 'yjs'
import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness'

export class SupabaseProvider {
  doc: Y.Doc
  channel: RealtimeChannel
  awareness: Awareness
  private _isConnected: boolean = false
  private _resyncInterval: ReturnType<typeof setInterval> | null = null

  constructor(doc: Y.Doc, supabase: SupabaseClient, channelId: string) {
    this.doc = doc
    this.awareness = new Awareness(doc)
    this.channel = supabase.channel(channelId)

    this.channel
      .on('broadcast', { event: 'sync-update' }, ({ payload }) => {
        // Payload comes in as an array of numbers from the broadcast
        const update = new Uint8Array(payload)
        Y.applyUpdate(doc, update, 'remote')
      })
      .on('broadcast', { event: 'awareness-update' }, ({ payload }) => {
        const update = new Uint8Array(payload)
        applyAwarenessUpdate(this.awareness, update, 'remote')
      })
      .on('broadcast', { event: 'request-sync' }, () => {
        if (this._isConnected) {
           const update = Y.encodeStateAsUpdate(doc)
           this.channel.send({
             type: 'broadcast',
             event: 'sync-update',
             // Broadcasts must use standard arrays (JSON compatible)
             payload: Array.from(update) 
           })
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this._isConnected = true
          this.channel.send({
            type: 'broadcast',
            event: 'request-sync',
            payload: {}
          })
        }
      })

    doc.on('update', (update, origin) => {
      if (origin !== 'remote' && this._isConnected) {
        this.channel.send({
          type: 'broadcast',
          event: 'sync-update',
          payload: Array.from(update),
        })
      }
    })

    this.awareness.on('update', ({ added, updated, removed }) => {
      if (!this._isConnected) return
      const changedClients = added.concat(updated).concat(removed)
      const update = encodeAwarenessUpdate(this.awareness, changedClients)
      this.channel.send({
        type: 'broadcast',
        event: 'awareness-update',
        payload: Array.from(update),
      })
    })
    
    this._resyncInterval = setInterval(() => {
        if (this._isConnected && this.awareness.getStates().size <= 1) {
            this.channel.send({ type: 'broadcast', event: 'request-sync', payload: {} })
        }
    }, 5000)
  }

  get hasPeers(): boolean {
    return this.awareness.getStates().size > 1
  }

  /**
   * Persists the full Yjs V1 binary state to Supabase using upsert.
   */
  async saveStateToSupabase(supabase: SupabaseClient, documentId: string) {
    const state = Y.encodeStateAsUpdate(this.doc)
    
    // CRITICAL FIX: Convert Uint8Array to Postgres Hex String (\x...)
    // This format is required for 'bytea' columns in Postgres.
    const hex = Array.from(state)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    const payload = `\\x${hex}`

    return supabase
      .from('documents')
      .upsert({ 
        id: documentId, 
        content: payload 
      })
  }

  destroy() {
    if (this._resyncInterval) clearInterval(this._resyncInterval)
    this.channel.unsubscribe()
    this.doc.destroy()
    this.awareness.destroy()
  }
}