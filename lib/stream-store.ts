/**
 * Module-level store for active SSE streams.
 * Survives React component unmount/remount, enabling:
 *   - Bug 1 fix: abort streams that don't match the newly mounted session
 *   - Bug 2 fix: keep streams alive and re-subscribe when returning to the same session
 */

export type StreamMessage = {
    id: string
    role: 'user' | 'assistant'
    content: string
    isStreaming?: boolean
    dbId?: string
    attachments?: any[]
}

type Listener = (
    messages: StreamMessage[],
    isGenerating: boolean,
    statusText: string
) => void

type Entry = {
    messages: StreamMessage[]
    isGenerating: boolean
    statusText: string
    controller: AbortController
    listeners: Set<Listener>
}

const registry = new Map<string, Entry>()

export const streamStore = {
    /** Whether a live stream is registered for this session */
    isActive(sessionId: string): boolean {
        return registry.has(sessionId)
    },

    /** Register a new stream (call BEFORE starting the fetch) */
    register(sessionId: string, initialMessages: StreamMessage[], controller: AbortController): void {
        registry.set(sessionId, {
            messages: [...initialMessages],
            isGenerating: true,
            statusText: '',
            controller,
            listeners: new Set(),
        })
    },

    /**
     * Re-key an entry (used when a new session ID is received from the server
     * to replace the temporary "pending-{timestamp}" key).
     */
    rekey(oldKey: string, newKey: string): void {
        const entry = registry.get(oldKey)
        if (entry && oldKey !== newKey) {
            registry.set(newKey, entry)
            registry.delete(oldKey)
        }
    },

    /** Update the entry and notify all listeners */
    update(sessionId: string, fn: (entry: Entry) => void): void {
        const entry = registry.get(sessionId)
        if (!entry) return
        fn(entry)
        const msgs = [...entry.messages]
        entry.listeners.forEach(l => l(msgs, entry.isGenerating, entry.statusText))
    },

    /**
     * Subscribe to stream updates.
     * Immediately invokes listener with the current state.
     * Returns an unsubscribe function.
     */
    subscribe(sessionId: string, listener: Listener): () => void {
        const entry = registry.get(sessionId)
        if (!entry) return () => { }
        entry.listeners.add(listener)
        listener([...entry.messages], entry.isGenerating, entry.statusText)
        return () => entry.listeners.delete(listener)
    },

    /** Get a snapshot of the current state without subscribing */
    getSnapshot(sessionId: string): { messages: StreamMessage[]; isGenerating: boolean } | null {
        const entry = registry.get(sessionId)
        if (!entry) return null
        return { messages: [...entry.messages], isGenerating: entry.isGenerating }
    },

    /**
     * Mark stream as done and remove from registry.
     * Notifies listeners one last time with isGenerating=false.
     */
    finish(sessionId: string): void {
        const entry = registry.get(sessionId)
        if (!entry) return
        entry.isGenerating = false
        entry.statusText = ''
        entry.listeners.forEach(l => l([...entry.messages], false, ''))
        registry.delete(sessionId)
    },

    /** Abort a specific stream and clean up */
    abort(sessionId: string): void {
        const entry = registry.get(sessionId)
        if (entry) {
            entry.controller.abort()
            registry.delete(sessionId)
        }
    },

    /**
     * Abort all streams EXCEPT the given sessionId.
     * Called on mount — clears orphaned streams from previous navigation.
     */
    abortAllExcept(sessionId: string | undefined): void {
        for (const [id, entry] of registry) {
            if (id !== sessionId) {
                entry.controller.abort()
                registry.delete(id)
            }
        }
    },
}
