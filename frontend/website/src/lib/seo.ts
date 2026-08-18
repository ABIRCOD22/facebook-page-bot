/**
 * seo.ts — centralised SEO: per-page Metadata, OpenGraph / Twitter
 * cards, and JSON-LD schema builders (Organization, SoftwareApplication,
 * FAQPage, BreadcrumbList). Designed to rank for "facebook ai bot",
 * "facebook page bot" and "ai moderator for facebook page".
 */
import type { Metadata, MetadataRoute } from "next"
import { SITE } from "./site"

export const PRIMARY_KEYWORD = "facebook ai bot"
export const SECONDARY_KEYWORDS = [
  "facebook page bot",
  "ai moderator for facebook page",
  "facebook messenger bot",
  "auto reply facebook page",
  "chatbot for facebook business page",
  "facebook auto reply",
  "bot for facebook page",
  "automate facebook page messages free",
]

export function absoluteUrl(path = ""): string {
  const base = SITE.url.replace(/\/$/, "")
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

interface PageSeoInput {
  title: string
  description: string
  path?: string
  keywords?: string[]
  type?: "website" | "article"
}

export function buildMetadata({ title, description, path = "/", keywords = [], type = "website" }: PageSeoInput): Metadata {
  const url = absoluteUrl(path)
  return {
    title,
    description,
    keywords: [PRIMARY_KEYWORD, ...SECONDARY_KEYWORDS, ...keywords],
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE.name,
      type,
      locale: "en_US",
      images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: SITE.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      site: SITE.twitter,
      images: [absoluteUrl("/opengraph-image")],
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  }
}

/** Default site metadata merged into every page via the root layout. */
export const SITE_METADATA: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "ChatriX — Your AI Moderator for Your Facebook Page",
    template: "%s · ChatriX",
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.name }],
  creator: SITE.name,
  publisher: SITE.name,
  category: "Technology",
  verification: {},
}

/* ----------------------------------------------------------------
   JSON-LD builders
   ---------------------------------------------------------------- */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    logo: absoluteUrl("/icon.svg"),
    description: SITE.description,
    sameAs: [SITE.twitter],
    contactPoint: {
      "@type": "ContactPoint",
      email: SITE.email,
      contactType: "customer support",
    },
  }
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE.name,
    operatingSystem: "Web",
    applicationCategory: "BusinessApplication",
    url: SITE.url,
    description:
      "ChatriX is an AI moderator for your Facebook page that auto-replies to Messenger and comments 24/7, trained on your products, with human handover.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "7-day free trial, no credit card required",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "1",
    },
  }
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  }
}

export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      item: absoluteUrl(t.path),
    })),
  }
}

/** Helper to safely inline JSON-LD in a Server Component. */
export function jsonLdScript(data: object) {
  return {
    __html: JSON.stringify(data),
  }
}

export function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE.url,
  }
}
