"use client"

/**
 * count-up.tsx — animates a number when scrolled into view. Supports a
 * numeric target with an optional prefix/suffix (e.g. "70", "<", "s").
 */
import * as React from "react"

interface CountUpProps {
  value: number
  prefix?: string
  suffix?: string
  duration?: number
  className?: string
}

export function CountUp({ value, prefix = "", suffix = "", duration = 1400, className }: CountUpProps) {
  const ref = React.useRef<HTMLSpanElement | null>(null)
  const [display, setDisplay] = React.useState(0)
  const started = React.useRef(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") {
      setDisplay(value)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started.current) {
            started.current = true
            const start = performance.now()
            const tick = (now: number) => {
              const t = Math.min(1, (now - start) / duration)
              const eased = 1 - Math.pow(1 - t, 3)
              setDisplay(Math.round(eased * value))
              if (t < 1) requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
          }
        })
      },
      { threshold: 0.4 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [value, duration])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  )
}
