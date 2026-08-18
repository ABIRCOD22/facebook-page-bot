"use client"

/**
 * reveal.tsx — scroll-into-view animation wrapper using IntersectionObserver.
 * Honours prefers-reduced-motion via CSS (.reveal base styles).
 */
import * as React from "react"
import { cn } from "@/lib/utils"

interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  delay?: 0 | 1 | 2 | 3 | 4
  as?: keyof React.JSX.IntrinsicElements
  zoom?: boolean
}

export function Reveal({
  className,
  children,
  delay = 0,
  as = "div",
  zoom = false,
  ...props
}: RevealProps) {
  const ref = React.useRef<HTMLElement | null>(null)
  const [inView, setInView] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setInView(true)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true)
            obs.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const Tag = as as React.ElementType
  return (
    <Tag
      ref={ref}
      className={cn(
        "reveal",
        delay === 1 && "reveal-delay-1",
        delay === 2 && "reveal-delay-2",
        delay === 3 && "reveal-delay-3",
        delay === 4 && "reveal-delay-4",
        zoom && "reveal-zoom",
        inView && "in-view",
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}

export default Reveal
