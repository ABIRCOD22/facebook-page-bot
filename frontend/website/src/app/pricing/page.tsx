/**
 * pricing/page.tsx — pricing page with a monthly/yearly toggle, anchored by
 * free 7-day trial. Content-first: short copy, prices, feature lists, and a
 * “Most Popular” highlight. Final CTA replaces the old trial band.
 */
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Reveal } from "@/components/reveal"
import { LinkButton, buttonVariants } from "@/components/ui/button"
import { PricingSection } from "@/components/pricing-toggle"
import { Faq } from "@/components/faq"
import { FinalCta } from "@/components/final-cta"
import { PRICING, FAQ } from "@/lib/site"
import { buildMetadata, faqJsonLd, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "Pricing — best facebook chatbot with a free 7-day trial",
  description:
    "Simple pricing for ChatriX, the AI moderator for your Facebook page. Start free for 7 days, then affordable plans that scale with your pages.",
  path: "/pricing",
  keywords: ["best facebook chatbot 2026", "facebook bot pricing", "facebook auto reply free trial"],
})

export default function PricingPage() {
  return (
    <>
      <section className="section-dense">
        <div className="container-x">
          <Reveal className="section-head">
            <span className="eyebrow">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Pricing
            </span>
            <h1 className="h1">Plans that scale with your Facebook pages</h1>
            <p className="lead max-w-2xl">
              Every plan starts with a 7-day free trial — no credit card. Pick the one that fits your pages today and
              upgrade anytime.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Pricing with monthly/yearly toggle */}
      <section className="section-dense">
        <div className="container-x">
          <Reveal>
            <PricingSection />
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-dense bg-surface">
        <div className="container-x">
          <Reveal className="section-head">
            <h2 className="h2">Pricing questions</h2>
          </Reveal>
          <div className="mt-10">
            <Faq items={FAQ} />
          </div>
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(faqJsonLd(FAQ))} />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ]))} />
      </section>

      <FinalCta />
    </>
  )
}