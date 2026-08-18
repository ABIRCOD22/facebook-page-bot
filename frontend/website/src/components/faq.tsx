"use client"

/**
 * faq.tsx — accessible accordion with smooth height animation.
 * Also exposes JSON-LD via the page (see /features).
 */
import * as React from "react"
import { Plus } from "lucide-react"
import { FAQ } from "@/lib/site"
import { cn } from "@/lib/utils"

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = React.useState(false)
  const panelRef = React.useRef<HTMLDivElement | null>(null)

  return (
    <div className={cn("faq-item", open && "open")}>
      <button
        className="faq-q"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{q}</span>
        <Plus className="faq-icon h-5 w-5" />
      </button>
      <div
        className="faq-a"
        ref={panelRef}
        style={{ maxHeight: open ? `${panelRef.current?.scrollHeight ?? 400}px` : 0 }}
      >
        <div className="faq-a-inner">{a}</div>
      </div>
    </div>
  )
}

export function Faq({ items = FAQ }: { items?: { q: string; a: string }[] }) {
  return (
    <div className="mx-auto max-w-3xl">
      {items.map((item) => (
        <FaqRow key={item.q} q={item.q} a={item.a} />
      ))}
    </div>
  )
}
