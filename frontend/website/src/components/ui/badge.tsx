/**
 * badge.tsx — chips / badges / pills used across the marketing site.
 */
import * as React from "react"
import { cn } from "@/lib/utils"

type Variant = "default" | "success" | "warning" | "destructive" | "outline" | "primary" | "accent" | "ink"

const variants: Record<Variant, string> = {
  default: "bg-primary/10 text-primary",
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/10 text-accent",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  destructive: "bg-destructive/10 text-destructive",
  outline: "border border-border text-muted-foreground",
  ink: "bg-ink text-white",
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
  dot?: boolean
}
export function Badge({ className, variant = "default", dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", variants[variant], className)}
      {...props}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  )
}

export interface ChipProps extends BadgeProps {}
export function Chip(props: ChipProps) {
  return <Badge {...props} />
}

export { Badge as default }
