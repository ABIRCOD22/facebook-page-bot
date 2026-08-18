/**
 * robots.ts — robots.txt for the marketing site. Allows all crawlers
 * and points to the sitemap.
 */
import type { MetadataRoute } from "next"
import { SITE } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  const base = SITE.url.replace(/\/$/, "")
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/register?*"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
