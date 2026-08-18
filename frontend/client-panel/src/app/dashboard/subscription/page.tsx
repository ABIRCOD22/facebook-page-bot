"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Crown, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"

const PLANS = [
  {
    name: "Free",
    price: "৳0",
    period: "/mo",
    features: ["1 Facebook page", "Up to 10 products", "Up to 20 knowledge articles", "Gemini-powered replies"],
    current: true,
  },
  {
    name: "Pro",
    price: "৳990",
    period: "/mo",
    features: ["3 Facebook pages", "Unlimited products", "Unlimited knowledge", "Priority responses", "Analytics"],
    current: false,
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    features: ["Unlimited pages", "Team access", "Custom AI tuning", "Dedicated support", "SLA"],
    current: false,
  },
]

export default function SubscriptionPage() {
  const [usage, setUsage] = useState<{ products: number; knowledge: number } | null>(null)
  const [sub, setSub] = useState<{ is_trial: boolean; payment_required: boolean; days_remaining: number; tier: string | null } | null>(null)

  useEffect(() => {
    Promise.all([api.listProducts().then((r) => r.total).catch(() => 0), api.listKnowledge().then((r) => r.items.length).catch(() => 0)])
      .then(([products, knowledge]) => setUsage({ products, knowledge }))
    api.getSubscription().then(setSub).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Subscription</h1>
        <p className="text-muted-foreground mt-1">Your current plan and usage.</p>
      </div>

      {sub?.payment_required && (
        <div className="rounded-lg border border-dashed p-4 flex items-center justify-between gap-4 bg-amber-50">
          <div>
            <p className="font-medium">Your trial has ended</p>
            <p className="text-sm text-muted-foreground">Renew your plan to keep your bot answering customers.</p>
          </div>
          <Link href="/payment" className={buttonVariants()}>
            Renew now
          </Link>
        </div>
      )}

      {sub?.is_trial && !sub.payment_required && (
        <div className="rounded-lg border p-4 bg-primary/5">
          <p className="text-sm">
            <span className="font-medium">Free trial active</span> — {sub.days_remaining} day
            {sub.days_remaining === 1 ? "" : "s"} remaining. Renew anytime to avoid interruption.
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Products</CardDescription>
            <CardTitle className="text-3xl">{usage ? usage.products : "—"}<span className="text-base text-muted-foreground font-normal"> / 10</span></CardTitle>
          </CardHeader>
          <CardContent><div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, ((usage?.products ?? 0) / 10) * 100)}%` }} /></div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Knowledge articles</CardDescription>
            <CardTitle className="text-3xl">{usage ? usage.knowledge : "—"}<span className="text-base text-muted-foreground font-normal"> / 20</span></CardTitle>
          </CardHeader>
          <CardContent><div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-accent" style={{ width: `${Math.min(100, ((usage?.knowledge ?? 0) / 20) * 100)}%` }} /></div></CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {PLANS.map((plan) => (
          <Card key={plan.name} className={plan.highlight ? "border-primary shadow-md relative" : ""}>
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground"><Sparkles className="w-3 h-3 mr-1" /> Popular</Badge>
              </div>
            )}
            <CardHeader>
              <div className="flex items-center gap-2">
                {plan.name === "Enterprise" && <Crown className="w-5 h-5 text-amber-500" />}
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                {plan.current && <Badge variant="success" className="ml-auto">Current</Badge>}
              </div>
              <CardDescription className="pt-2">
                <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" variant={plan.current ? "outline" : "default"} disabled={plan.current}>
                {plan.current ? "Current plan" : plan.name === "Enterprise" ? "Contact sales" : "Upgrade"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
