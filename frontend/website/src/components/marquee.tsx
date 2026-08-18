/**
 * marquee.tsx — infinitely scrolling chip row of industries/use-cases.
 * Pure CSS animation (pause on hover), duplication gives a seamless loop.
 */
import * as React from "react"

interface MarqueeProps {
  items: string[]
  reverse?: boolean
  icon?: React.ReactNode
}

export function Marquee({ items, reverse = false, icon }: MarqueeProps) {
  return (
    <div className="marquee" role="list">
      <div className={reverse ? "marquee-track rev" : "marquee-track"}>
        {items.map((it, i) => (
          <span className="marquee-chip" key={`a-${i}`} role="listitem">
            {icon}
            {it}
          </span>
        ))}
        {items.map((it, i) => (
          <span className="marquee-chip" key={`b-${i}`} aria-hidden>
            {icon}
            {it}
          </span>
        ))}
      </div>
    </div>
  )
}
