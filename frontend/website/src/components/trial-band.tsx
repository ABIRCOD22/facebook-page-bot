/**
 * trial-band.tsx — free-trial scarcity / reciprocity band. Real 7-day
 * trial (genuine, not fake urgency).
 */
import * as React from "react"
import Link from "next/link"
import { ArrowRight, Gift } from "lucide-react"
import { Reveal } from "@/components/reveal"
import { LinkButton, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TRUST_POINTS } from "@/lib/site"

export function TrialBand() {
  return (
    <section className="section-tight">
      <div className="container-x">
        <Reveal>
          <div className="cta-band">
            <div className="blob blob-3" aria-hidden />
            <Badge variant="ink" className="mb-4">
              <Gift className="h-3.5 w-3.5" /> 7-day free trial
            </Badge>
            <h2 className="h2 max-w-2xl mx-auto">Start free for 7 days — no credit card, cancel anytime</h2>
            <p className="lead max-w-xl mx-auto mt-4">
              Give your Facebook page an AI moderator today. Connect a token, train it on your products, and watch
              replies go out in under a minute.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <LinkButton href="/register" variant="white" size="xl" rightIcon={<ArrowRight className="h-5 w-5" />}>
                Register a AI moderator for your page
              </LinkButton>
              <Link href="/pricing" className={buttonVariants({ variant: "ghost", size: "xl", className: "text-white" })}>
                View pricing
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
              {TRUST_POINTS.map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
