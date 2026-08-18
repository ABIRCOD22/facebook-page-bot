/**
 * about/page.tsx — compact about page. Hero, Stats, Meta API note,
 * contact (email + free trial). No mission paragraphs, no fabricated
 * testimonials.
 */
import type { Metadata } from "next"
import Link from "next/link"
import { Mail, ArrowRight } from "lucide-react"
import { Reveal } from "@/components/reveal"
import { LinkButton, buttonVariants } from "@/components/ui/button"
import { FinalCta } from "@/components/final-cta"
import { STATS, SITE } from "@/lib/site"
import { buildMetadata, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo"

export const metadata: Metadata = buildMetadata({
  title: "About — the AI moderator for your Facebook page",
  description:
    "ChatriX helps page owners automate Facebook Messenger and comments with an AI moderator built on official Meta APIs. Learn our mission and how to reach us.",
  path: "/about",
  keywords: ["about ChatriX", "facebook page automation", "Meta API chatbot"],
})

export default function AboutPage() {
  return (
    <>
      {/* Compact hero */}
      <section className="section-dense bg-surface-2">
        <div className="container-x">
          <Reveal className="section-head">
            <span className="eyebrow">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> About
            </span>
            <h1 className="h1">We help page owners automate</h1>
            <p className="lead mt-2">
              Connect a Facebook Page Access Token and your AI moderator replies
              to Messenger and comments 24/7, trained on your products.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Stats */}
      <section className="section-dense bg-surface-2">
        <div className="container-x">
          <Reveal>
            <div className="stat-grid">
              {STATS.map((s, i) => (
                <div key={s.label} className={i > 0 ? "stat-divider pl-6" : ""}>
                  <div className="stat-num">
                    <span className="stat-value">{s.prefix ?? ""}</span>
                    <span className="stat-number">{s.value}</span>
                    <span className="stat-suffix">{s.suffix ?? ""}</span>
                  </div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Meta */}
      <section className="section-dense">
        <div className="container-x">
          <Reveal>
            <p className="mt-2 text-soft">
              Built on official Meta APIs — compliant, reliable, and future-proof.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Contact */}
      <section className="section-dense">
        <div className="container-x">
          <Reveal className="flex flex-col gap-4">
            <LinkButton href="/register" variant="gradient" size="xl" rightIcon={<ArrowRight className="h-5 w-5" />}>
              Start free trial
            </LinkButton>
            <Link prefetch={false}
              href={`mailto:${SITE.email}`}
              className={buttonVariants({ variant: "ghost", size: "lg", className: "text-soft" })}
            >
              <Mail className="h-4 w-4" /> {SITE.email}
            </Link>
          </Reveal>
        </div>
      </section>

      <FinalCta />

      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "About", path: "/about" },
      ]))} />
    </>
  )
}