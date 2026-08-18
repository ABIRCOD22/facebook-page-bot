"use client"

/**
 * pricing-toggle.tsx — pricing section with a monthly/yearly switch.
 * Prices animate between tiers; "Most Popular" plan highlighted.
 */
import * as React from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { LinkButton } from "@/components/ui/button"
import { Reveal } from "@/components/reveal"
import { PRICING } from "@/lib/site"

export function PricingSection() {
  const [yearly, setYearly] = React.useState(false)

  return (
    <div>
      <div className="center" style={{ marginBottom: "1.75rem" }}>
        <div className="toggle" role="group" aria-label="Billing period">
          <button className={`toggle-btn ${!yearly ? "active" : ""}`} onClick={() => setYearly(false)} aria-pressed={!yearly}>
            Monthly
          </button>
          <button className={`toggle-btn ${yearly ? "active" : ""}`} onClick={() => setYearly(true)} aria-pressed={yearly}>
            Yearly <span className="toggle-save">−2 months</span>
          </button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {PRICING.map((p, i) => (
          <Reveal key={p.name} delay={((i % 3) + 1) as 0 | 1 | 2 | 3 | 4}>
            <div className={`card-pricing ${p.popular ? "is-popular" : ""}`}>
              {p.popular ? (
                <span className="chip chip-primary absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</span>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xl font-semibold text-ink">{p.name}</h3>
              </div>
              <p className="text-sm text-soft">{p.description}</p>
              <div className="flex items-end gap-1">
                <span className="price-amount" style={{ transition: "opacity .2s" }}>
                  {yearly ? p.priceYearly : p.priceMonthly}
                </span>
                <span className="price-period">{p.period}</span>
              </div>
              <LinkButton
                href={p.ctaHref}
                variant={p.popular ? "gradient" : "outline"}
                size="lg"
                fullWidth
              >
                {p.ctaLabel}
              </LinkButton>
              <ul className="flex flex-col">
                {p.features.map((f) => (
                  <li key={f} className="price-feature">
                    <Check className="price-check h-4 w-4" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  )
}
