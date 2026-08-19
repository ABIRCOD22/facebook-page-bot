"use client"

/**
 * checkout/page.tsx — step 2 of the onboarding funnel. Shows the plans.
 * Payment is not live yet, so a Continue button skips straight to setup.
 */
import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { LoadingButton, LinkButton } from "@/components/ui/button"
import { Reveal } from "@/components/reveal"
import { PricingSection } from "@/components/pricing-toggle"
import { loadCreds, clientPanelLoginUrl } from "@/lib/api"

export default function CheckoutPage() {
  const router = useRouter()
  const [leaving, setLeaving] = React.useState(false)
  const creds = loadCreds()

  React.useEffect(() => {
    if (!creds) router.replace("/register")
  }, [creds, router])

  if (!creds) return null

  return (
    <section className="section bg-surface-2">
      <div className="container-x">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto stack-md">
            <p className="eyebrow">Step 2 of 3</p>
            <h1 className="h2 mt-2">Choose your plan</h1>
            <p className="text-soft">
              Every plan includes the full bot: 24/7 auto-replies, training, handover and analytics.
              Starts with a 7-day free trial — no credit card. <b>Payment is being set up</b> — for now
              just continue.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-mut">
              <ShieldCheck className="h-4 w-4" /> Account <b>&quot;{creds.email}&quot;</b> is created and waiting.
            </div>
          </div>
        </Reveal>

        <Reveal>
          <PricingSection />
        </Reveal>

        <Reveal>
          <div className="text-center mt-10">
            <LoadingButton
              size="lg"
              variant="gradient"
              loading={leaving}
              onClick={() => {
                setLeaving(true)
                router.push("/setup")
              }}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Continue to bot setup
            </LoadingButton>
            <p className="text-sm text-mut mt-3">
              Payment is coming soon — the Continue button skips it for now.
            </p>
            <div className="mt-4">
              <LinkButton href={clientPanelLoginUrl()} variant="ghost" size="sm">
                I already have a dashboard account — log in instead
              </LinkButton>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}