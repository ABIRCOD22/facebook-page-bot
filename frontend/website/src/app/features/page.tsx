import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Hero } from "@/components/hero"
import { Features } from "@/components/features"
import { FeatureTabs } from "@/components/feature-tabs"
import { BentoFeatures } from "@/components/bento"
import { Faq } from "@/components/faq"
import { FinalCta } from "@/components/final-cta"
import { SITE, FEATURES as PageFeatures, FAQ as PageFAQ, TRUST_POINTS, STATS } from "@/lib/site"
import { buildMetadata, faqJsonLd, jsonLdScript } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "ChatriX Features — AI Auto Reply, Messenger Bot & Human Handover",
  description:
    "Facebook AI bot features: 24/7 auto-reply, Messenger bot, knowledge training, human handover, multilingual replies, analytics and safety guardrails.",
  path: "/features",
})

export default function FeaturesPage() {
  return (
    <main>
      <Hero />

      <section className="section-dense">
        <div className="container-x">
          <Features />
        </div>
      </section>

      <section className="section-dense">
        <div className="container-x">
          <FeatureTabs />
        </div>
      </section>

      <section className="section-dense">
        <div className="container-x">
          <BentoFeatures />
        </div>
      </section>

      <section id="faq" className="section-dense">
        <div className="container-x">
          <h2 className="h2 mt-2">Frequently asked questions</h2>
          <div style={{ marginTop: "1.5rem" }}>
            <Faq items={PageFAQ} />
          </div>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(faqJsonLd(PageFAQ))} />
      <FinalCta />
    </main>
  )
}