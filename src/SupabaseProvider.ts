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
      // 1. Handle Awareness (Cursors/Presence)
      .on('broadcast', { event: 'awareness-update' }, ({ payload }) => {
        applyAwarenessUpdate(this.awareness, new Uint8Array(payload), 'remote')
      })
      
      // 2. Sync Step 1: Remote peer sent their State Vector
      // We calculate what they are missing and send ONLY that (Sync Step 2)
      .on('broadcast', { event: 'sync-step-1' }, ({ payload }) => {
        const remoteVector = new Uint8Array(payload)
        const update = Y.encodeStateAsUpdate(doc, remoteVector)
        // Only broadcast if there is actually a difference
        if (update.length > 0) {
            this.broadcast('sync-step-2', update)
        }
      })

      // 3. Sync Step 2: Remote peer sent an Update
      // We apply this update to our local document
      .on('broadcast', { event: 'sync-step-2' }, ({ payload }) => {
        const update = new Uint8Array(payload)
        Y.applyUpdate(doc, update, 'remote')
      })

      // 4. Connection Status
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this._isConnected = true
          this.initSync()
        } else {
          this._isConnected = false
        }
      })

    // 5. Listen to Local Changes -> Broadcast Update (Step 2)
    doc.on('update', (update, origin) => {
      if (origin !== 'remote' && origin !== 'db-load' && this._isConnected) {
        // We broadcast the update directly to peers
        this.broadcast('sync-step-2', update)
      }
    })

    // 6. Listen to Local Awareness Changes
    this.awareness.on('update', ({ added, updated, removed }) => {
      if (!this._isConnected) return
      const changedClients = added.concat(updated).concat(removed)
      const update = encodeAwarenessUpdate(this.awareness, changedClients)
      this.broadcast('awareness-update', update)
    })

    // 7. Periodic Health Check / Soft Resync (Every 30s)
    this._resyncInterval = setInterval(() => {
      if (this._isConnected && this.awareness.getStates().size > 0) {
        this.initSync()
      }
    }, 30000)
  }

  // Initiates the sync protocol by sending our local State Vector
  private initSync() {
    // We send our State Vector (fingerprint) so peers know what we need
    const vector = Y.encodeStateVector(this.doc)
    this.broadcast('sync-step-1', vector)
  }

  private broadcast(event: string, payload: Uint8Array) {
    if (!this._isConnected) return
    this.channel.send({
      type: 'broadcast',
      event,
      payload: Array.from(payload),
    })
  }

  destroy() {
    if (this._resyncInterval) clearInterval(this._resyncInterval)
    this.channel.unsubscribe()
    this.awareness.destroy()
    // DOC LIFECYCLE: We do NOT destroy the doc here.
    // The doc is owned by the React Component state.
  }
}