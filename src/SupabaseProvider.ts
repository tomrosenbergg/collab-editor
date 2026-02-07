// src/SupabaseProvider.ts
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
        // Apply incoming updates from peers
        const update = new Uint8Array(payload)
        Y.applyUpdate(doc, update, 'remote')
      })
      .on('broadcast', { event: 'awareness-update' }, ({ payload }) => {
        // Apply awareness (cursor) updates
        const update = new Uint8Array(payload)
        applyAwarenessUpdate(this.awareness, update, 'remote')
      })
      .on('broadcast', { event: 'request-sync' }, () => {
        // If a new peer asks for state, and we are connected, send it
        if (this._isConnected) {
          const update = Y.encodeStateAsUpdate(doc)
          this.broadcast('sync-update', update)
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this._isConnected = true
          // Request latest state from peers immediately
          this.channel.send({
            type: 'broadcast',
            event: 'request-sync',
            payload: {},
          })
        } else {
          this._isConnected = false
        }
      })

    // Listen to local document updates and broadcast them
    doc.on('update', (update, origin) => {
      if (origin !== 'remote' && origin !== 'db-load' && this._isConnected) {
        this.broadcast('sync-update', update)
      }
    })

    // Listen to local awareness updates and broadcast them
    this.awareness.on('update', ({ added, updated, removed }) => {
      if (!this._isConnected) return
      const changedClients = added.concat(updated).concat(removed)
      const update = encodeAwarenessUpdate(this.awareness, changedClients)
      this.broadcast('awareness-update', update)
    })

    // Periodic "Soft" Resync (Every 30s instead of 5s to save bandwidth)
    // This handles cases where a packet might have been dropped.
    this._resyncInterval = setInterval(() => {
      if (this._isConnected && this.awareness.getStates().size > 1) {
        this.channel.send({ type: 'broadcast', event: 'request-sync', payload: {} })
      }
    }, 30000)
  }

  // Helper to send byte arrays
  private broadcast(event: string, payload: Uint8Array) {
    this.channel.send({
      type: 'broadcast',
      event,
      payload: Array.from(payload), // Supabase Realtime requires standard arrays
    })
  }

  destroy() {
    if (this._resyncInterval) clearInterval(this._resyncInterval)
    this.channel.unsubscribe()
    this.awareness.destroy()
    // NOTE: We do NOT destroy the doc here, as React might still need it
    // for a split second before unmounting.
  }
}