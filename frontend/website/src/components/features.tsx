/**
 * features.tsx — compact grid of every feature (icon + title + one-line
 * caption). Used on the /features page under the interactive tabs.
 */
import * as React from "react"
import { Reveal } from "@/components/reveal"
import { FEATURES } from "@/lib/site"

export function Features() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f, i) => (
        <Reveal key={f.title} delay={((i % 3) + 1) as 0 | 1 | 2 | 3 | 4} id={f.id}>
          <div className="card-mini">
            <span className="mini-icon"><f.icon className="h-5 w-5" /></span>
            <div>
              <div className="mini-title">{f.title}</div>
              <div className="mini-cap">{f.caption}</div>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  )
}
