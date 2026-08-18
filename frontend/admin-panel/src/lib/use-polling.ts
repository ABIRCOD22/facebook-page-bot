"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Poll an async function every `intervalMs`. Used by admin pages for near-real-time
 * dashboards without websockets (ponytail: 10s polling is enough for an admin panel).
 */
export function usePolling<T>(fn: () => Promise<T>, intervalMs = 10000, immediate = true) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savedFn = useRef(fn)
  savedFn.current = fn

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setInterval>

    const run = async () => {
      setLoading(true)
      try {
        const res = await savedFn.current()
        if (active) setData(res)
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load")
      } finally {
        if (active) setLoading(false)
      }
    }

    if (immediate) run()
    timer = setInterval(run, intervalMs)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [intervalMs, immediate])

  return { data, loading, error }
}
