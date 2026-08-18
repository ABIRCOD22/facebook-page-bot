/**
 * stats-strip.tsx — social proof band with animated counters. Real,
 * sourced industry stats (no fabricated customer quotes).
 */
import * as React from "react"
import { Reveal } from "@/components/reveal"
import { CountUp } from "@/components/count-up"
import { STATS } from "@/lib/site"

export function StatsStrip() {
  return (
    <section className="section-dense">
      <div className="container-x">
        <Reveal>
          <div className="statband">
            <div className="stat-grid">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="stat-num">
                    <CountUp value={s.value} prefix={s.prefix} suffix={s.suffix} />
                  </div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
