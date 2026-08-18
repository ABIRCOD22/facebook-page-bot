import * as React from "react"
import { cn } from "@/lib/utils"

type Variant = "default" | "success" | "warning" | "destructive" | "outline" | "secondary"

const variants: Record<Variant, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  destructive: "bg-destructive/10 text-destructive",
  outline: "border border-border text-muted-foreground",
  secondary: "bg-slate-100 text-slate-700",
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
