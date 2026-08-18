"use client"

/**
 * tilt-card.tsx — subtle 3D tilt on pointer move. Disabled under
 * prefers-reduced-motion. Wraps children in a perspective container.
 */
import * as React from "react"
import { cn } from "@/lib/utils"

export function TiltCard({ children, className, max = 8 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [style, setStyle] = React.useState<React.CSSProperties>({})

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    setStyle({ transform: `perspective(900px) rotateY(${px * max}deg) rotateX(${-py * max}deg)` })
  }
  const reset = () => setStyle({ transform: "perspective(900px) rotateY(0) rotateX(0)" })

  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={reset} className={cn("tilt", className)} style={style}>
      {children}
    </div>
  )
}
