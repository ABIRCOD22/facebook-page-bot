"use client"

/**
 * setup/page.tsx — step 3 of the onboarding funnel: the bot config form.
 * Asks whether the user already has a Facebook page, walks them through
 * creating one if needed, previews the connect steps, then finishes.
 */
import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, CheckCircle2, MessagesSquare } from "lucide-react"
import { Button, LoadingButton, LinkButton } from "@/components/ui/button"
import { Reveal } from "@/components/reveal"
import { loadCreds, clientPanelLoginUrl } from "@/lib/api"

type Step = "ask" | "creating" | "guide"

const CREATE_STEPS = [
  "Go to facebook.com/pages/create and log in to the Facebook account that will manage the page.",
  "Choose a category that matches your business (e.g. Restaurant, Clinic, Online Store).",
  "Add your business name, profile photo and cover photo — the bot answers using your page's identity.",
  "Publish the page. You do not need to post anything yet.",
]

const CONNECT_STEPS = [
  "Create a free Meta app at developers.facebook.com/apps (type: Business) and copy its App ID and App Secret from Settings → Basic.",
  "Open the Graph API Explorer, click Get Page Access Token, choose your page and copy the EAAB… token.",
  "Log in to your dashboard, paste the token + App ID + App Secret on the Page Connection screen and click Connect.",
  "Copy the green verify token shown after connecting and paste it into your app's Messenger → Webhooks (callback URL is provided on that screen).",
  "Message your page from a second Facebook account — your bot replies within seconds.",
]

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = React.useState<Step>("ask")
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
            <p className="eyebrow">Step 3 of 3</p>
            <h1 className="h2 mt-2">Configure your bot</h1>
            <p className="text-soft">
              Two quick questions, then your dashboard credentials are ready. Account: <b>{creds.email}</b>
            </p>
          </div>
        </Reveal>

        <Reveal>
          <div className="auth-card mt-10">
            {step === "ask" && (
              <div className="stack-lg">
                <div className="flex items-center gap-2">
                  <span className="brand-mark"><MessagesSquare className="h-5 w-5" /></span>
                  <h3 className="h3 m-0">Do you already have a Facebook page?</h3>
                </div>
                <p className="text-sm text-soft m-0">
                  Your bot lives on a Facebook Page. If you do not have one yet, we will show you how to create it in a few minutes.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button variant="outline" size="lg" onClick={() => setStep("creating")}>
                    No, not yet
                  </Button>
                  <Button size="lg" variant="gradient" onClick={() => setStep("guide")}>
                    Yes, I have one
                  </Button>
                </div>
              </div>
            )}

            {step === "creating" && (
              <div className="stack-lg">
                <div className="flex items-center gap-2">
                  <span className="brand-mark"><CheckCircle2 className="h-5 w-5" /></span>
                  <h3 className="h3 m-0">Create your Facebook page</h3>
                </div>
                <ol className="stack-sm m-0 pl-5 text-sm text-soft">
                  {CREATE_STEPS.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <div className="grid gap-3 sm:grid-cols-2">
                  <a
                    href="https://www.facebook.com/pages/create"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 h-11 rounded-lg px-6 text-base bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-[transform,box-shadow,background-color] duration-200 active:scale-[0.98]"
                  >
                    Open facebook.com/pages/create
                  </a>
                  <Button size="lg" variant="gradient" onClick={() => setStep("guide")}>
                    I've created my page
                  </Button>
                </div>
              </div>
            )}

            {step === "guide" && (
              <div className="stack-lg">
                <div className="flex items-center gap-2">
                  <span className="brand-mark"><CheckCircle2 className="h-5 w-5" /></span>
                  <h3 className="h3 m-0">Almost done — how your bot gets connected</h3>
                </div>
                <p className="text-sm text-soft m-0">
                  After you get your login below, your dashboard walks you through every click. Here is the short version:
                </p>
                <ol className="stack-sm m-0 pl-5 text-sm text-soft">
                  {CONNECT_STEPS.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <LoadingButton
                  size="lg"
                  variant="gradient"
                  fullWidth
                  loading={leaving}
                  onClick={() => {
                    setLeaving(true)
                    router.push("/welcome")
                  }}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Finish — show my login credentials
                </LoadingButton>
                <div className="text-center">
                  <LinkButton href={clientPanelLoginUrl()} variant="ghost" size="sm">
                    I already have a dashboard account — log in instead
                  </LinkButton>
                </div>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}