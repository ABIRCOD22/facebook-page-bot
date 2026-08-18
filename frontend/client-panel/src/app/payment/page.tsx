"use client"

import Link from "next/link"
import { CreditCard, Sparkles } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function PaymentPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl" style={{ fontFamily: "var(--font-heading)" }}>
            Renew your subscription
          </CardTitle>
          <CardDescription>
            Your trial has ended. Reactivate to keep your Facebook bot answering customers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground text-center">
            <Sparkles className="w-5 h-5 mx-auto mb-2 text-primary" />
            Online payments via <strong>Gini Pay</strong> are coming soon.
            <br />
            For now, message us to renew and we&apos;ll activate your plan.
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/dashboard" className={buttonVariants({ className: "w-full" })}>
              Back to dashboard
            </Link>
            <Link href="/dashboard/subscription" className={buttonVariants({ variant: "outline", className: "w-full" })}>
              View plans
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
