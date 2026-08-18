/**
 * card.tsx — ChatriX marketing card system
 * ------------------------------------------------------------------
 * Provides a low-level <Card> primitive plus a family of marketing
 * specific cards (feature, pricing, stat, glass, media, testimonial,
 * callout). Every card forwards refs and composes with Tailwind
 * utility classes via `cn`.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

/* ================================================================
   Low-level primitive
   ================================================================ */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }>(
  ({ className, hover = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border bg-card text-card-foreground shadow-sm",
        hover && "card-x",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  )
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
)
CardFooter.displayName = "CardFooter"

/* ================================================================
   Feature card
   ================================================================ */
export interface FeatureCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  badge?: React.ReactNode
  footer?: React.ReactNode
}
const FeatureCard = React.forwardRef<HTMLDivElement, FeatureCardProps>(
  ({ className, icon, title, description, badge, footer, children, ...props }, ref) => (
    <div ref={ref} className={cn("card-feature", className)} {...props}>
      {badge ? <div className="mb-4">{badge}</div> : null}
      {icon ? <div className="feature-icon">{icon}</div> : null}
      <h3 className="feature-title">{title}</h3>
      {description ? <p className="feature-desc">{description}</p> : null}
      {children}
      {footer ? <div className="mt-5">{footer}</div> : null}
    </div>
  )
)
FeatureCard.displayName = "FeatureCard"

/* ================================================================
   Pricing card
   ================================================================ */
export interface PricingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  name: React.ReactNode
  price: React.ReactNode
  period?: React.ReactNode
  description?: React.ReactNode
  features: React.ReactNode[]
  popular?: boolean
  badge?: React.ReactNode
  cta?: React.ReactNode
}
const PricingCard = React.forwardRef<HTMLDivElement, PricingCardProps>(
  ({ className, name, price, period, description, features, popular = false, badge, cta, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("card-pricing", popular && "is-popular", className)}
      aria-label={`${typeof name === "string" ? name : "Plan"} plan`}
      {...props}
    >
      {popular && !badge ? (
        <span className="chip chip-primary absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</span>
      ) : badge ? (
        <div>{badge}</div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xl font-semibold text-ink">{name}</h3>
      </div>
      {description ? <p className="text-sm text-soft">{description}</p> : null}
      <div className="flex items-end gap-1">
        <span className="price-amount">{price}</span>
        {period ? <span className="price-period">{period}</span> : null}
      </div>
      <div className="flex flex-col">{cta}</div>
      <ul className="flex flex-col">
        {features.map((f, i) => (
          <li key={i} className="price-feature">
            <Check className="price-check h-4 w-4" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  )
)
PricingCard.displayName = "PricingCard"

/* ================================================================
   Stat card
   ================================================================ */
export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  value: React.ReactNode
  label: React.ReactNode
  hint?: React.ReactNode
}
const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, value, label, hint, ...props }, ref) => (
    <div ref={ref} className={cn("text-center", className)} {...props}>
      <div className="stat-num">{value}</div>
      <div className="stat-label">{label}</div>
      {hint ? <div className="mt-1 text-xs text-mut">{hint}</div> : null}
    </div>
  )
)
StatCard.displayName = "StatCard"

/* ================================================================
   Glass card
   ================================================================ */
const GlassCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("card-glass", className)} {...props} />
  )
)
GlassCard.displayName = "GlassCard"

/* ================================================================
   Media card (image / illustration left or right)
   ================================================================ */
export interface MediaCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  media: React.ReactNode
  title?: React.ReactNode
  body?: React.ReactNode
  reverse?: boolean
}
const MediaCard = React.forwardRef<HTMLDivElement, MediaCardProps>(
  ({ className, media, title, body, reverse, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("card-x overflow-hidden grid grid-cols-1 md:grid-cols-2", reverse && "md:[&>*:first-child]:order-2", className)}
      {...props}
    >
      <div className="bg-surface-2 grid place-items-center p-6">{media}</div>
      <div className="p-6 flex flex-col gap-2">
        {title ? <h3 className="text-xl font-semibold text-ink">{title}</h3> : null}
        {body ? <p className="text-soft">{body}</p> : null}
        {children}
      </div>
    </div>
  )
)
MediaCard.displayName = "MediaCard"

/* ================================================================
   Callout card
   ================================================================ */
export interface CalloutCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  accent?: boolean
  title?: React.ReactNode
}
const CalloutCard = React.forwardRef<HTMLDivElement, CalloutCardProps>(
  ({ className, accent = false, title, children, ...props }, ref) => (
    <div ref={ref} className={cn("callout", accent && "callout-accent", className)} {...props}>
      {title ? <p className="font-semibold mb-1">{title}</p> : null}
      {children}
    </div>
  )
)
CalloutCard.displayName = "CalloutCard"

/* ================================================================
   Small helpers / icons
   ================================================================ */
function Check({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

/* ================================================================
   Convenience hook: hover-tracking card (for analytics / cursor glow)
   ================================================================ */
export function useCardHoverGlow<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null)
  const [glow, setGlow] = React.useState<{ x: number; y: number } | null>(null)

  const onMove = (e: React.MouseEvent<T>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setGlow({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }
  const onLeave = () => setGlow(null)

  return { ref, glow, onMove, onLeave }
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  FeatureCard,
  PricingCard,
  StatCard,
  GlassCard,
  MediaCard,
  CalloutCard,
}
