/**
 * hero.tsx — above-the-fold hero (white, dense). Left: value + CTAs +
 * trust chips. Right: the interactive Live Chat Demo so visitors see the
 * product answer in real time.
 */
import * as React from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, MessageCircleHeart } from "lucide-react"
import { LinkButton, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Reveal } from "@/components/reveal"
import { LiveChatDemo } from "@/components/live-chat-demo"
import { HERO_BULLETS, SITE } from "@/lib/site"

export function Hero() {
  return (
    <section className="hero bg-surface-2 relative overflow-hidden">
      <div className="blob blob-1 float-slow" aria-hidden />
      <div className="blob blob-2 float-slower" aria-hidden />
      <div className="container-x" style={{ paddingBlock: "clamp(2.5rem, 5vw, 4.5rem)", position: "relative", zIndex: 1 }}>
        <div className="hero-grid">
          <Reveal className="stack-lg">
            <Badge variant="primary">
              <MessageCircleHeart className="h-3.5 w-3.5" />
              AI moderator for your Facebook page
            </Badge>
            <h1 className="display">
              Never miss a sale on Facebook — your{" "}
              <span className="gradient-text">AI bot</span> replies 24/7
            </h1>
            <p className="lead mt-3 max-w-xl">
              ChatriX is a facebook ai bot that auto-replies to Messenger and comments, trained on your products —
              with human handover. Set up in two minutes, no code.
            </p>

            <div className="hero-cta">
              <LinkButton href="/register" variant="gradient" size="xl" rightIcon={<ArrowRight className="h-5 w-5" />}>
                Register a AI moderator
              </LinkButton>
              <Link prefetch={false} href="/features" className={buttonVariants({ variant: "outline", size: "xl" })}>
                See features
              </Link>
            </div>

            <ul className="hero-trust">
              {HERO_BULLETS.map((b) => (
                <li key={b.text} className="inline-flex items-center">
                  <span className="dot" />
                  <b.icon className="mr-1.5 h-4 w-4 text-primary" />
                  {b.text}
                </li>
              ))}
            </ul>

            <div className="row-sm mt-2 text-sm text-soft">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 7-day free trial
              <span className="text-line">•</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> No credit card
              <span className="text-line">•</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Cancel anytime
            </div>
          </Reveal>

          <Reveal delay={2} zoom className="relative">
            <LiveChatDemo />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
