"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { toast } from "sonner"
import { streamStore, AttachmentProgress } from "@/lib/stream-store"
import type { Attachment, UIMessage, AvailableModel, DBMessage } from "../types"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function useChatStream({
    initialSessionId,
    initialMessages,
    availableModels,
    initialSelectedModel,
    initialSystemPrompt,
    initialQuery,
    projectId,
    onSessionCreated,
}: {
    initialSessionId?: string
    initialMessages: DBMessage[]
    availableModels: AvailableModel[]
    initialSelectedModel?: string
    initialSystemPrompt?: string | null
    initialQuery?: string
    projectId?: string
    onSessionCreated?: (id: string, title: string) => void
}) {
    const router = useRouter()
    const pathname = usePathname()
    const segments = pathname?.split('/').filter(Boolean) || []
    const localePrefix = segments.length && segments[0].length <= 5 ? `/${segments[0]}` : ''

    const [sessionId, setSessionId] = useState(initialSessionId)
    const storeKeyRef = useRef<string | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)
    const [messages, setMessages] = useState<UIMessage[]>(
        initialMessages.map(m => ({
            id: m.id,
            dbId: m.id,
            role: m.role,
            content: m.content,
            attachments: Array.isArray(m.attachments) ? m.attachments : []
        }))
    )
    const [selectedModel, setSelectedModel] = useState(initialSelectedModel || availableModels[0]?.value || "")
    const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt ?? "")
    const [isGenerating, setIsGenerating] = useState(false)
    const [statusText, setStatusText] = useState("")
    const [attachmentProgress, setAttachmentProgress] = useState<AttachmentProgress[]>([])

    useEffect(() => {
        if (availableModels.length > 0 && !selectedModel) {
            setSelectedModel(availableModels[0].value)
        }
    }, [availableModels])

    // Mount: reconnect to live stream if it exists
    useEffect(() => {
        if (initialSessionId && streamStore.isActive(initialSessionId)) {
            const snap = streamStore.getSnapshot(initialSessionId)
            if (snap) {
                setMessages(snap.messages as UIMessage[])
                setIsGenerating(snap.isGenerating)
            }
            const unsub = streamStore.subscribe(initialSessionId, (msgs, generating, status, attProg) => {
                setMessages(msgs as UIMessage[])
                setIsGenerating(generating)
                setStatusText(status)
                setAttachmentProgress(attProg)
            })
            storeKeyRef.current = initialSessionId
            return unsub
        }

        return () => { }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const sendMessage = useCallback(async (
        content: string,
        atts: Attachment[],
        msgEditId?: string,
        keptAtts: Attachment[] = []
    ) => {
        const allAtts = [...keptAtts, ...atts]
        if (!content.trim() && allAtts.length === 0) return
        if (isGenerating) return
        if (!selectedModel) {
            toast.error("請先在設定頁面配置並選擇一個模型。")
            return
        }

        // Save model preference (optimistic, non-blocking)
        const selModelObj = availableModels.find(m => m.value === selectedModel)
        if (selModelObj) {
            fetch('/api/user/preference', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selectedModel: selModelObj.label,
                    selectedProviderPrefix: selModelObj.providerPrefix,
                }),
            }).catch(() => { })
        }

        setIsGenerating(true)
        setStatusText("正在連線...")

        const userMsg: UIMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content,
            attachments: allAtts.map(a => ({ name: a.name, mimeType: a.mimeType, base64: a.base64 }))
        }

        const safeEditId = msgEditId && UUID_RE.test(msgEditId) ? msgEditId : undefined

        let historyMessages: UIMessage[]
        if (safeEditId) {
            const cutIdx = messages.findIndex(m => m.dbId === safeEditId)
            historyMessages = cutIdx >= 0 ? messages.slice(0, cutIdx) : messages
        } else {
            historyMessages = messages
        }

        const aiMsgId = `ai-${Date.now()}`
        setMessages([...historyMessages, userMsg, { id: aiMsgId, role: "assistant", content: "", isStreaming: true }])

        const conversationHistory = historyMessages.map(m => ({ id: m.dbId, role: m.role, content: m.content }))
        conversationHistory.push({ id: undefined, role: 'user' as const, content })

        const failActiveStream = (errorText?: string) => {
            const fallback = errorText || '產生回應失敗，請稍後再試。'
            setMessages(prev => prev.map(m => {
                if (m.id === aiMsgId) {
                    return { ...m, isStreaming: false, content: m.content || fallback }
                }
                return m
            }))
            const activeKey = storeKeyRef.current
            if (activeKey) {
                streamStore.update(activeKey, e => {
                    e.isGenerating = false
                    e.statusText = ''
                    e.messages = e.messages.map(m => m.id === aiMsgId ? { ...m, isStreaming: false, content: m.content || fallback } : m)
                })
                streamStore.finish(activeKey)
                window.dispatchEvent(new CustomEvent('chat:active', { detail: null }))
                storeKeyRef.current = null
            }
            setIsGenerating(false)
            setStatusText('')
            setAttachmentProgress([])
            abortControllerRef.current?.abort()
            abortControllerRef.current = null
        }

        try {
            const ac = new AbortController()
            abortControllerRef.current = ac

            const tempKey = sessionId || `pending-${Date.now()}`
            const initialStoreMessages: UIMessage[] = [
                ...historyMessages,
                userMsg,
                { id: aiMsgId, role: 'assistant' as const, content: '', isStreaming: true }
            ]
            streamStore.register(tempKey, initialStoreMessages as any, ac)
            storeKeyRef.current = tempKey
            window.dispatchEvent(new CustomEvent('chat:active', { detail: tempKey }))

            const res = await fetch("/api/chat/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: ac.signal,
                body: JSON.stringify({
                    messages: conversationHistory,
                    sessionId: sessionId || null,
                    selectedModel,
                    systemPrompt: systemPrompt || null,
                    attachments: allAtts,
                    editMessageId: safeEditId || null,
                    projectId: projectId || null,
                })
            })

            if (!res.ok || !res.body) {
                const errMsg = "請求失敗: " + res.statusText
                toast.error(errMsg)
                failActiveStream(errMsg)
                return
            }

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let aiMsgDbId: string | undefined
            let userMsgDbId: string | undefined
            const tempUserMsgId = userMsg.id
            let buffer = ""
            let streamErrored = false

            while (true) {
                const { value, done } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    const dataStr = line.slice(6).trim()
                    if (!dataStr) continue
                    try {
                        const ev = JSON.parse(dataStr)
                        if (ev.type === 'session_id') {
                            const realId = ev.data as string
                            if (storeKeyRef.current && storeKeyRef.current !== realId) {
                                streamStore.rekey(storeKeyRef.current, realId)
                                storeKeyRef.current = realId
                                window.dispatchEvent(new CustomEvent('chat:active', { detail: realId }))
                            }
                            setSessionId(realId)
                            const targetPath = projectId ? `${localePrefix}/p/${projectId}/c/${realId}` : `${localePrefix}/c/${realId}`
                            router.replace(targetPath)
                            onSessionCreated?.(realId, '')
                        } else if (ev.type === 'status') {
                            setStatusText(ev.data)
                            if (ev.data === '') {
                                setAttachmentProgress([])
                                if (storeKeyRef.current) streamStore.update(storeKeyRef.current, e => { e.attachmentProgress = [] })
                            }
                            if (storeKeyRef.current) streamStore.update(storeKeyRef.current, e => { e.statusText = ev.data })
                        } else if (ev.type === 'attachments_status') {
                            setAttachmentProgress(ev.data.attachments)
                            if (storeKeyRef.current) streamStore.update(storeKeyRef.current, e => { e.attachmentProgress = ev.data.attachments })
                        } else if (ev.type === 'chunk') {
                            setMessages(prev => prev.map(m =>
                                m.id === aiMsgId ? { ...m, content: m.content + ev.data } : m
                            ))
                            if (storeKeyRef.current) streamStore.update(storeKeyRef.current, e => {
                                const msg = e.messages.find(m => m.id === aiMsgId)
                                if (msg) msg.content += ev.data
                            })
                        } else if (ev.type === 'error') {
                            toast.error(ev.data)
                            failActiveStream(ev.data)
                            streamErrored = true
                            break
                        } else if (ev.type === 'title_updated') {
                            window.dispatchEvent(new CustomEvent('sidebar:refresh'))
                            if (ev.data?.sessionId && ev.data?.title) {
                                onSessionCreated?.(ev.data.sessionId, ev.data.title)
                            }
                        } else if (ev.type === 'done') {
                            aiMsgDbId = ev.data?.messageId
                            userMsgDbId = ev.data?.userMessageId
                            setMessages(prev => prev.map(m => {
                                if (m.id === aiMsgId) return { ...m, isStreaming: false, dbId: aiMsgDbId }
                                if (m.id === tempUserMsgId) return { ...m, dbId: userMsgDbId }
                                return m
                            }))
                            setIsGenerating(false)
                            setStatusText('')
                            setAttachmentProgress([])
                            if (storeKeyRef.current) streamStore.update(storeKeyRef.current, e => {
                                const aiMsg = e.messages.find(m => m.id === aiMsgId)
                                if (aiMsg) { aiMsg.isStreaming = false; aiMsg.dbId = aiMsgDbId }
                                const usrMsg = e.messages.find(m => m.id === tempUserMsgId)
                                if (usrMsg) usrMsg.dbId = userMsgDbId
                                e.isGenerating = false
                                e.statusText = ''
                                e.attachmentProgress = []
                            })
                        }
                    } catch { }
                }
                if (streamErrored) break
            }
            if (streamErrored) return
            const finishedKey = storeKeyRef.current
            if (finishedKey) {
                streamStore.finish(finishedKey)
                window.dispatchEvent(new CustomEvent('chat:active', { detail: null }))
                storeKeyRef.current = null
                abortControllerRef.current = null
                if (!finishedKey.startsWith('pending-')) {
                    router.refresh()
                }
            }

        } catch (e: any) {
            if (e.name === 'AbortError') {
                setIsGenerating(false)
                setStatusText('')
                setAttachmentProgress([])
                abortControllerRef.current = null
                if (storeKeyRef.current) {
                    streamStore.abort(storeKeyRef.current)
                    window.dispatchEvent(new CustomEvent('chat:active', { detail: null }))
                    storeKeyRef.current = null
                }
                return
            }
            toast.error('串流連線失敗: ' + e.message)
            failActiveStream()
        } finally {
            setIsGenerating(false)
            setStatusText('')
            setAttachmentProgress([])
        }
    }, [isGenerating, messages, sessionId, selectedModel, systemPrompt, router])

    const handleRegenerate = useCallback(async (msgId: string) => {
        const idx = messages.findIndex(m => m.id === msgId || m.dbId === msgId)
        if (idx <= 0) return
        const userMsg = messages[idx - 1]
        if (userMsg.role !== 'user') return

        const regenEditId = userMsg.dbId && UUID_RE.test(userMsg.dbId) ? userMsg.dbId : undefined

        const prevMessages = messages.slice(0, idx - 1)
        const aiMsgId = `ai-regen-${Date.now()}`
        setMessages([...prevMessages, userMsg, { id: aiMsgId, role: 'assistant', content: '', isStreaming: true }])
        setIsGenerating(true)
        setStatusText("正在重新生成...")

        const markRegenFailed = (errorText?: string) => {
            const fallback = errorText || '重新生成失敗，請稍後再試。'
            setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, isStreaming: false, content: m.content || fallback } : m))
        }

        const history = [...prevMessages.map(m => ({ id: m.dbId, role: m.role, content: m.content })), { role: 'user', content: userMsg.content }]

        const userAtts = (userMsg.attachments || []).map(a => ({
            name: a.name,
            mimeType: a.mimeType,
            base64: a.base64 || '',
        }))

        try {
            const res = await fetch("/api/chat/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: history,
                    sessionId,
                    selectedModel,
                    systemPrompt: systemPrompt || null,
                    attachments: userAtts,
                    editMessageId: regenEditId || null,
                })
            })
            if (!res.ok || !res.body) {
                const errMsg = '重新生成失敗: ' + res.statusText
                toast.error(errMsg)
                markRegenFailed(errMsg)
                setIsGenerating(false)
                setStatusText("")
                return
            }

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ""
            let aiMsgDbId: string | undefined
            let newUserMsgDbId: string | undefined
            const existingUserMsgId = userMsg.id
            let streamErrored = false

            while (true) {
                const { value, done } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    try {
                        const ev = JSON.parse(line.slice(6).trim())
                        if (ev.type === 'status') {
                            setStatusText(ev.data)
                            if (ev.data === '') setAttachmentProgress([])
                        } else if (ev.type === 'attachments_status') setAttachmentProgress(ev.data.attachments)
                        else if (ev.type === 'chunk') {
                            setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: m.content + ev.data } : m))
                        } else if (ev.type === 'title_updated') {
                            window.dispatchEvent(new CustomEvent('sidebar:refresh'))
                        } else if (ev.type === 'error') {
                            toast.error(ev.data)
                            markRegenFailed(ev.data)
                            streamErrored = true
                            break
                        } else if (ev.type === 'done') {
                            aiMsgDbId = ev.data?.messageId
                            newUserMsgDbId = ev.data?.userMessageId
                            setMessages(prev => prev.map(m => {
                                if (m.id === aiMsgId) return { ...m, isStreaming: false, dbId: aiMsgDbId }
                                if (m.id === existingUserMsgId) return { ...m, dbId: newUserMsgDbId }
                                return m
                            }))
                            setIsGenerating(false)
                            setStatusText("")
                            setAttachmentProgress([])
                        }
                    } catch { }
                }
                if (streamErrored) break
            }
            if (streamErrored) return
            if (sessionId) router.refresh()
        } catch (e: any) {
            toast.error('重新生成失敗: ' + (e?.message || ''))
            markRegenFailed()
        } finally {
            setIsGenerating(false)
            setStatusText("")
            setAttachmentProgress([])
        }
    }, [messages, sessionId, selectedModel, systemPrompt, router])

    // Handle auto-starting chat from home page query
    const hasFiredInitialQuery = useRef(false)
    useEffect(() => {
        if (initialQuery && !hasFiredInitialQuery.current && messages.length === 0 && selectedModel) {
            hasFiredInitialQuery.current = true;
            window.history.replaceState({}, '', '/chat');
            setTimeout(() => {
                sendMessage(initialQuery, []);
            }, 0);
        }
    }, [initialQuery, messages.length, selectedModel, sendMessage]);

    const handleModelChange = useCallback((modelValue: string) => {
        setSelectedModel(modelValue)

        const modelObj = availableModels.find(m => m.value === modelValue)
        if (!modelObj) return

        fetch('/api/user/preference', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                selectedModel: modelObj.label,
                selectedProviderPrefix: modelObj.providerPrefix,
            }),
        }).catch(() => { })

        if (sessionId) {
            fetch(`/api/chat/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelName: modelObj.label,
                    providerPrefix: modelObj.providerPrefix,
                }),
            }).catch(() => { })
        }
    }, [availableModels, sessionId])

    return {
        messages,
        setMessages,
        input: "",
        selectedModel,
        systemPrompt,
        setSystemPrompt,
        isGenerating,
        statusText,
        attachmentProgress,
        sendMessage,
        handleRegenerate,
        handleModelChange,
    }
}
