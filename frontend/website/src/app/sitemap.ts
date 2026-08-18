/**
 * sitemap.ts — dynamic XML sitemap for the marketing site. Helps
 * Google index the facebook ai bot / page bot subject pages.
 */
import type { MetadataRoute } from "next"
import { SITE } from "@/lib/site"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url.replace(/\/$/, "")
  const now = new Date()
  const routes = [
    { path: "/", priority: 1.0, change: "daily" as const },
    { path: "/features", priority: 0.9, change: "weekly" as const },
    { path: "/pricing", priority: 0.9, change: "weekly" as const },
    { path: "/about", priority: 0.7, change: "monthly" as const },
    { path: "/register", priority: 0.8, change: "monthly" as const },
  ]
  return routes.map((r) => ({
    url: `${base}${r.path}`,
    lastModified: now,
    changeFrequency: r.change,
    priority: r.priority,
  }))
}
