"use client"

import { useState, useRef, useEffect } from "react"

export function useAutoScroll(isGenerating: boolean) {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    const [isAutoScrolling, setIsAutoScrolling] = useState(true)
    const isAutoScrollingRef = useRef(isAutoScrolling)
    useEffect(() => { isAutoScrollingRef.current = isAutoScrolling }, [isAutoScrolling])
    const [showScrollButton, setShowScrollButton] = useState(false)
    const observerBoundRef = useRef(false)

    // IntersectionObserver: show/hide the scroll button based on messagesEndRef visibility
    useEffect(() => {
        if (observerBoundRef.current) return
        const chatContainer = scrollContainerRef.current
        const messagesEnd = messagesEndRef.current
        if (!chatContainer || !messagesEnd) return
        observerBoundRef.current = true
        let lastScrollTop = chatContainer.scrollTop

        const checkScrollPosition = (isEndVisible?: boolean) => {
            const { scrollHeight, scrollTop, clientHeight } = chatContainer
            const distanceToBottom = scrollHeight - scrollTop - clientHeight
            const isAtBottom = Math.abs(distanceToBottom) < 1

            const containerRect = chatContainer.getBoundingClientRect()
            const endRect = messagesEnd.getBoundingClientRect()
            const computedVisible =
                typeof isEndVisible !== "undefined"
                    ? isEndVisible
                    : endRect.top >= containerRect.top && endRect.bottom <= containerRect.bottom
            setShowScrollButton(prev => {
                if (isAutoScrollingRef.current) return false
                const next = computedVisible ? false : !isAtBottom
                if (prev === next) return prev
                return next
            })
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => checkScrollPosition(entry.isIntersecting))
            },
            { root: chatContainer, threshold: 0.1 }
        )
        observer.observe(messagesEnd)

        const handleScroll = () => {
            const { scrollHeight, scrollTop, clientHeight } = chatContainer
            const distanceToBottom = scrollHeight - scrollTop - clientHeight
            const scrolledUp = scrollTop + 2 < lastScrollTop
            if (isAutoScrollingRef.current && scrolledUp && distanceToBottom > 12) {
                setIsAutoScrolling(false)
            }
            lastScrollTop = scrollTop
            checkScrollPosition()
        }
        chatContainer.addEventListener("scroll", handleScroll)

        const resizeObserver = new ResizeObserver(() => checkScrollPosition())
        resizeObserver.observe(chatContainer)

        const mutationObserver = new MutationObserver(() => {
            if (isAutoScrollingRef.current) {
                chatContainer.scrollTop = chatContainer.scrollHeight
            }
            checkScrollPosition()
        })
        mutationObserver.observe(chatContainer, {
            childList: true,
            subtree: true,
            characterData: true,
        })

        checkScrollPosition()

        return () => {
            observerBoundRef.current = false
            chatContainer.removeEventListener("scroll", handleScroll)
            resizeObserver.disconnect()
            mutationObserver.disconnect()
            observer.disconnect()
        }
    })

    // rAF loop + wheel listener: the core auto-scroll engine
    useEffect(() => {
        if (!isAutoScrolling) return

        const chatContainer = scrollContainerRef.current
        if (!chatContainer) return

        let animationFrameId: number

        const tick = () => {
            chatContainer.scrollTop = chatContainer.scrollHeight
            animationFrameId = requestAnimationFrame(tick)
        }

        const handleWheel = (event: WheelEvent) => {
            if (chatContainer.contains(event.target as Node)) {
                setIsAutoScrolling(false)
            }
        }
        const handleTouchMove = () => {
            setIsAutoScrolling(false)
        }

        animationFrameId = requestAnimationFrame(tick)
        window.addEventListener("wheel", handleWheel, { passive: true })
        chatContainer.addEventListener("touchmove", handleTouchMove, { passive: true })

        return () => {
            cancelAnimationFrame(animationFrameId)
            window.removeEventListener("wheel", handleWheel)
            chatContainer.removeEventListener("touchmove", handleTouchMove)
        }
    }, [isAutoScrolling])

    // Start auto-scroll when generation begins; stop when it ends
    const prevIsGeneratingRef = useRef(false)
    useEffect(() => {
        if (isGenerating && !prevIsGeneratingRef.current) {
            setIsAutoScrolling(true)
        }
        prevIsGeneratingRef.current = isGenerating
    }, [isGenerating])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        setTimeout(() => setIsAutoScrolling(true), 500)
    }

    return {
        messagesEndRef,
        scrollContainerRef,
        showScrollButton,
        scrollToBottom,
    }
}
