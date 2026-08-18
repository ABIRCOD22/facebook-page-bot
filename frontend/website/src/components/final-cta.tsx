/**
 * final-cta.tsx — the single, tight conversion band. White, centered,
 * one job: start the free trial.
 */
import * as React from "react"
import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { LinkButton, buttonVariants } from "@/components/ui/button"
import { Reveal } from "@/components/reveal"

export function FinalCta() {
  return (
    <section className="section-dense">
      <div className="container-x">
        <Reveal>
          <div className="cta-band">
            <span className="cta-glow" aria-hidden />
            <span className="chip chip-primary mb-4">
              <Sparkles className="h-3.5 w-3.5" /> 7-day free trial · no card
            </span>
            <h2 className="display-sm">Turn your Facebook page into a 24/7 AI team</h2>
            <p className="mt-2 max-w-xl">
              Connect your page, train your bot on your products, and watch replies happen automatically —
              with a human one tap away.
            </p>
            <div className="hero-cta center mt-5">
              <LinkButton href="/register" variant="gradient" size="xl" rightIcon={<ArrowRight className="h-5 w-5" />}>
                Register a AI moderator
              </LinkButton>
              <Link href="/features" className={buttonVariants({ variant: "outline", size: "xl" })}>
                Explore features
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
