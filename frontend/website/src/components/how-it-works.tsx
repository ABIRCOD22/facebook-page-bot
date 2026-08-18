/**
 * how-it-works.tsx — three visual steps. Each step shows its mock so the
 * flow reads as product, not prose.
 */
import * as React from "react"
import { Reveal } from "@/components/reveal"
import { TokenMock, TrainMock, ChatMock } from "@/components/product-mockups"
import { STEPS } from "@/lib/site"

const MOCKS = { token: TokenMock, train: TrainMock, chat: ChatMock }

export function HowItWorks() {
  return (
    <section id="how" className="section-dense bg-surface-2">
      <div className="container-x">
        <Reveal className="max-w-2xl">
          <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> How it works</span>
          <h2 className="h2 mt-2">Live in three steps, no code</h2>
        </Reveal>

        <div className="steps">
          {STEPS.map((s, i) => {
            const Mock = MOCKS[s.visual]
            return (
              <Reveal key={s.n} delay={((i % 3) + 1) as 0 | 1 | 2 | 3 | 4} className="step-cell">
                <div className="step-head">
                  <span className="step-n">{s.n}</span>
                  <s.icon className="step-icon h-5 w-5" />
                </div>
                <h3 className="step-title">{s.title}</h3>
                <p className="step-body">{s.body}</p>
                <div className="step-mock"><Mock /></div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
