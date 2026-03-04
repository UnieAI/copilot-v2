"use client"

import { useSyncExternalStore, useCallback } from "react"

export interface SelectedInstance {
  id: string
  name: string
  port: number
  hostname?: string
}

const STORAGE_KEY = "opencode-selected-instance"

let currentInstance: SelectedInstance | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

function loadFromStorage(): SelectedInstance | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SelectedInstance
  } catch {
    return null
  }
}

function saveToStorage(instance: SelectedInstance | null) {
  if (typeof window === "undefined") return
  try {
    if (instance) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(instance))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // localStorage unavailable
  }
}

// Initialize from storage on module load
if (typeof window !== "undefined") {
  currentInstance = loadFromStorage()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): SelectedInstance | null {
  return currentInstance
}

function getServerSnapshot(): SelectedInstance | null {
  return null
}

export function setInstance(instance: SelectedInstance | null) {
  currentInstance = instance
  saveToStorage(instance)
  notify()
}

export function useInstanceStore() {
  const instance = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const set = useCallback((next: SelectedInstance | null) => {
    setInstance(next)
  }, [])

  return { instance, setInstance: set }
}
