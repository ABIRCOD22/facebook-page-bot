/**
 * footer.tsx — site footer with brand blurb, link columns, social, and
 * a compliance / authority line ("Built on official Meta APIs").
 */
import * as React from "react"
import Link from "next/link"
import { Bot, ShieldCheck, ArrowUpRight } from "lucide-react"
import { FOOTER_COLUMNS, SITE } from "@/lib/site"

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="footer section-tight">
      <div className="container-x">
        <div className="footer-grid">
          <div>
            <Link prefetch={false} href="/" className="brand" style={{ color: "#fff" }} aria-label={`${SITE.name} home`}>
              <span className="brand-mark">
                <Bot className="h-5 w-5" />
              </span>
              {SITE.name}
            </Link>
            <p className="mt-4 max-w-sm text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
              Your AI moderator for your Facebook page. Auto-reply to Messenger and comments 24/7, trained on your
              products, with human handover.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs" style={{ color: "rgba(255,255,255,0.85)" }}>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Built on official Meta APIs
            </div>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="footer-title">{col.title}</h4>
              {col.links.map((l) => (
                <Link prefetch={false} key={l.href + l.label} href={l.href} className="footer-link">
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="footer-bottom">
          <span>© {year} {SITE.name}. All rights reserved.</span>
          <span className="inline-flex items-center gap-4">
            <Link prefetch={false} href="/about" className="hover:text-white">About</Link>
            <Link prefetch={false} href="/pricing" className="hover:text-white">Pricing</Link>
            <Link prefetch={false} href="/register" className="hover:text-white inline-flex items-center gap-1">
              Get started <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </span>
        </div>
      </div>
    </footer>
  )
}
