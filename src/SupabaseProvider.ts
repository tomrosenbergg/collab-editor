import * as Y from 'yjs'
import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness'

export class SupabaseProvider {
  doc: Y.Doc
  channel: RealtimeChannel
  awareness: Awareness
  private _isConnected: boolean = false
  private _resyncInterval: any

  constructor(doc: Y.Doc, supabase: SupabaseClient, channelId: string) {
    this.doc = doc
    this.awareness = new Awareness(doc)
    this.channel = supabase.channel(channelId)

    this.channel
      .on('broadcast', { event: 'sync-update' }, ({ payload }) => {
        // Apply updates from others
        const update = new Uint8Array(payload)
        Y.applyUpdate(doc, update, 'remote')
      })
      .on('broadcast', { event: 'awareness-update' }, ({ payload }) => {
        // Update cursors
        const update = new Uint8Array(payload)
        applyAwarenessUpdate(this.awareness, update, 'remote')
      })
      .on('broadcast', { event: 'request-sync' }, () => {
        // Another user just joined and asked for data.
        // We send our current document state to them.
        if (this._isConnected) {
           const update = Y.encodeStateAsUpdate(doc)
           this.channel.send({
             type: 'broadcast',
             event: 'sync-update',
             payload: Array.from(update)
           })
        }
      })
      .subscribe((status) => {
        console.log('SYSTEM: Realtime Status:', status)
        
        if (status === 'SUBSCRIBED') {
          this._isConnected = true
          
          // HANDSHAKE: Ask other users for their latest state
          // This fixes the issue where you see old DB data on load
          this.channel.send({
            type: 'broadcast',
            event: 'request-sync',
            payload: {}
          })
        }
      })

    // Broadcast local document changes
    doc.on('update', (update, origin) => {
      if (origin !== 'remote' && this._isConnected) {
        this.channel.send({
          type: 'broadcast',
          event: 'sync-update',
          payload: Array.from(update),
        })
      }
    })

    // Broadcast cursor changes
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
    
    // Optional: Periodically ask for sync to ensure consistency (Self-healing)
    this._resyncInterval = setInterval(() => {
        if (this._isConnected && this.awareness.getStates().size <= 1) {
            // If we think we are alone, ask just in case
            this.channel.send({ type: 'broadcast', event: 'request-sync', payload: {} })
        }
    }, 5000)
  }

  destroy() {
    clearInterval(this._resyncInterval)
    this.channel.unsubscribe()
    this.doc.destroy()
    this.awareness.destroy()
  }
}