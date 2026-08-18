/**
 * bento.tsx — visual-first feature grid. Big hero cell with a live mock,
 * smaller cells with icons + one-line captions. No paragraphs.
 */
import * as React from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Reveal } from "@/components/reveal"
import { LinkButton, buttonVariants } from "@/components/ui/button"
import { ChatMock, InboxMock, TrainMock, AnalyticsMock, TokenMock } from "@/components/product-mockups"
import { BENTO } from "@/lib/site"

const MOCKS = { chat: ChatMock, inbox: InboxMock, train: TrainMock, analytics: AnalyticsMock, token: TokenMock }

export function BentoFeatures() {
  return (
    <section className="section-dense">
      <div className="container-x">
        <Reveal className="between" style={{ marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Features</span>
            <h2 className="h2 mt-2">A facebook page bot that does it all</h2>
          </div>
          <Link href="/features" className={buttonVariants({ variant: "outline", size: "sm" })}>
            All features <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>

        <div className="bento">
          {BENTO.map((c, i) => {
            const Mock = c.mock ? MOCKS[c.mock] : null
            return (
              <Reveal
                key={c.title}
                delay={((i % 4) + 1) as 0 | 1 | 2 | 3 | 4}
                className={`bento-cell ${c.span}`}
              >
                {Mock ? (
                  <div style={{ marginBottom: "0.9rem" }}>
                    <Mock />
                  </div>
                ) : (
                  <span className="bento-icon"><c.icon className="h-5 w-5" /></span>
                )}
                <div className="bento-title">{c.title}</div>
                <div className="bento-cap">{c.caption}</div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
