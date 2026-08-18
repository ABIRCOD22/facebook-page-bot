import type { Metadata } from "next"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { Hero } from "@/components/hero"
import { StatsStrip } from "@/components/stats-strip"
import { BentoFeatures } from "@/components/bento"
import { FeatureTabs } from "@/components/feature-tabs"
import { HowItWorks } from "@/components/how-it-works"
import { ComparisonSlider } from "@/components/comparison-slider"
import { PricingSection } from "@/components/pricing-toggle"
import { Faq } from "@/components/faq"
import { FinalCta } from "@/components/final-cta"
import { Marquee } from "@/components/marquee"
import { Reveal } from "@/components/reveal"
import { buttonVariants } from "@/components/ui/button"
import { SITE, MARQUEE_ITEMS, FAQ } from "@/lib/site"
import { buildMetadata, faqJsonLd, jsonLdScript } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "ChatriX — AI Moderator for Your Facebook Page (24/7 Auto-Reply)",
  description: SITE.description,
  path: "/",
})

export default function HomePage() {
  return (
    <main>
      <Hero />

      <section className="section-dense">
        <div className="container-x">
          <p className="marquee-eyebrow">Built for every kind of Page</p>
        </div>
        <Marquee items={MARQUEE_ITEMS} />
      </section>

      <BentoFeatures />

      <section className="section-dense">
        <div className="container-x">
          <Reveal className="max-w-2xl">
            <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Product tour</span>
            <h2 className="h2 mt-2">See the facebook ai bot in action</h2>
            <p className="lead mt-2">Four things it does for you, all day, every day.</p>
          </Reveal>
          <FeatureTabs />
        </div>
      </section>

      <HowItWorks />

      <section className="section-dense bg-surface-2">
        <div className="container-x">
          <Reveal className="max-w-2xl">
            <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Before / after</span>
            <h2 className="h2 mt-2">Manual vs ChatriX AI moderator</h2>
            <p className="lead mt-2">Drag to compare how a customer question gets handled.</p>
          </Reveal>
          <ComparisonSlider />
        </div>
      </section>

      <StatsStrip />

      <section id="pricing" className="section-dense">
        <div className="container-x">
          <Reveal className="max-w-2xl">
            <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Pricing</span>
            <h2 className="h2 mt-2">Start free, scale when you grow</h2>
            <p className="lead mt-2">7-day trial on every plan. No credit card.</p>
          </Reveal>
          <div style={{ marginTop: "1.75rem" }}>
            <PricingSection />
          </div>
        </div>
      </section>

      <section className="section-dense">
        <div className="container-x">
          <Reveal className="max-w-2xl">
            <span className="eyebrow"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> FAQ</span>
            <h2 className="h2 mt-2">Questions, answered</h2>
          </Reveal>
          <div style={{ marginTop: "1.5rem" }}>
            <Faq items={FAQ} />
          </div>
          <div className="center mt-6">
            <Link href="/features" className={buttonVariants({ variant: "outline", size: "sm" })}>
              More on features <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <FinalCta />

      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(faqJsonLd(FAQ))} />
    </main>
  )
}
