"use client"

/**
 * navbar.tsx — sticky marketing navbar with scroll shadow, active-link
 * highlighting and a mobile slide-down menu. Client component because
 * it tracks scroll position and toggles state.
 */
import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, Bot, ArrowRight } from "lucide-react"
import { NAV_LINKS, SITE } from "@/lib/site"
import { Button, LinkButton, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function Navbar() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = React.useState(false)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  React.useEffect(() => {
    setOpen(false)
  }, [pathname])

  const isActive = (href: string) => {
    const clean = href.split("#")[0]
    if (clean === "/") return pathname === "/"
    return pathname.startsWith(clean)
  }

  return (
    <header className={cn("nav", scrolled && "scrolled")}>
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="container-x nav-inner">
        <Link href="/" className="brand" aria-label={`${SITE.name} home`}>
          <span className="brand-mark">
            <Bot className="h-5 w-5" />
          </span>
          {SITE.name}
        </Link>

        <nav className="nav-links" aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn("nav-link", isActive(l.href) && "active")}
              aria-current={isActive(l.href) ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="nav-cta">
          <Link href="/register" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "desktop-cta")}>
            Log in
          </Link>
          <LinkButton href="/register" variant="gradient" size="sm" className="desktop-cta" rightIcon={<ArrowRight className="h-4 w-4" />}>
            Get Started
          </LinkButton>
          <button
            className="nav-toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className={cn("mobile-menu container-x", open && "open")}>
        {NAV_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="nav-link">
            {l.label}
          </Link>
        ))}
        <Link href="/register" className={cn(buttonVariants({ variant: "gradient" }), "btn-block mt-2")}>
          Get Started
        </Link>
        <Link href="/register" className={cn(buttonVariants({ variant: "ghost" }), "btn-block")}>
          Log in
        </Link>
      </div>
    </header>
  )
}
