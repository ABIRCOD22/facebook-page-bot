"use client"

/**
 * comparison-slider.tsx — draggable before/after. Left pane = "no bot"
 * (slow, lost chats), right pane = "with ChatriX" (fast auto-replies).
 */
import * as React from "react"
import { Clock, Zap, XCircle } from "lucide-react"

export function ComparisonSlider() {
  const [pos, setPos] = React.useState(52)
  const ref = React.useRef<HTMLDivElement | null>(null)
  const dragging = React.useRef(false)

  const setFromClientX = (clientX: number) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPos(Math.max(6, Math.min(94, pct)))
  }

  const onDown = (e: React.PointerEvent) => {
    dragging.current = true
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    setFromClientX(e.clientX)
  }
  const onMove = (e: React.PointerEvent) => {
    if (dragging.current) setFromClientX(e.clientX)
  }
  const onUp = () => {
    dragging.current = false
  }

  return (
    <div
      ref={ref}
      className="compare"
      style={{ aspectRatio: "16 / 9" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      role="slider"
      aria-label="Before and after comparison"
      aria-valuenow={Math.round(pos)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPos((p) => Math.max(6, p - 4))
        if (e.key === "ArrowRight") setPos((p) => Math.min(94, p + 4))
      }}
    >
      {/* Right (after) full bleed */}
      <div className="compare-pane compare-b">
        <div className="compare-label r">With ChatriX</div>
        <div className="compare-inner">
          <div className="row-sm"><Zap className="h-5 w-5 text-primary" /><b style={{ color: "var(--ink)" }}>Auto-replies in &lt;60s</b></div>
          <div className="row-sm"><span className="mock-pill p">Messenger 24/7</span><span className="mock-pill a">Comments too</span></div>
          <div style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>No missed chats. Visitors become customers while you sleep.</div>
        </div>
      </div>

      {/* Left (before) clipped */}
      <div className="compare-pane compare-a" style={{ width: `${pos}%`, borderRight: "2px solid #fff" }}>
        <div className="compare-label l">Without a bot</div>
        <div className="compare-inner">
          <div className="row-sm"><Clock className="h-5 w-5 text-muted-foreground" /><b style={{ color: "var(--ink)" }}>Replies in 12h+</b></div>
          <div className="row-sm"><XCircle className="h-5 w-5 text-muted-foreground" /><span style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>Lost chats & missed sales</span></div>
        </div>
      </div>

      <div className="compare-handle" style={{ left: `${pos}%` }}>
        <div className="compare-knob">⇄</div>
      </div>
    </div>
  )
}
