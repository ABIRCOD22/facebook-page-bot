"use client"

/**
 * setup/page.tsx — step 3 of the onboarding funnel: a visual, step-by-step
 * bot setup wizard. One screen per step with graphical mock previews, and a
 * final step that verifies against the backend whether the bot is connected.
 */
import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  MessageCircle,
  MessagesSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Link2,
} from "lucide-react"
import { Button, LoadingButton, LinkButton } from "@/components/ui/button"
import { Reveal } from "@/components/reveal"
import { SITE } from "@/lib/site"
import { loadCreds, clearCreds, checkBotConnection, clientPanelLoginUrl, type BotStatus } from "@/lib/api"

type Step = "ask" | "creating" | "wizard"

const CREATE_STEPS = [
  "Go to facebook.com/pages/create and log in to the Facebook account that will manage the page.",
  "Choose a category that matches your business (e.g. Restaurant, Clinic, Online Store).",
  "Add your business name, profile photo and cover photo — the bot answers using your page's identity.",
  "Publish the page. You do not need to post anything yet.",
]

const STEP_TITLES = [
  "Create your Meta app",
  "Get your Page Access Token",
  "Connect your page in the dashboard",
  "Switch on incoming messages (webhooks)",
  "Test your bot",
  "Verify your connection",
]

const WEBHOOK_CALLBACK = "https://facebook-page-bot-rdkt.onrender.com/api/webhook"

/** Fake browser window used to illustrate each step graphically. */
function BrowserMock({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white shadow-lg overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line bg-muted px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-3 flex-1 truncate rounded-md bg-white border border-line px-3 py-1 text-[11px] text-mut select-all">
          {url}
        </span>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  )
}

function MiniButton({ children, primary = false }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium " +
        (primary ? "bg-[#1877F2] text-white" : "border border-line bg-white text-ink")
      }
    >
      {children}
    </span>
  )
}

function MiniField({ label, value, green = false }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-mut">{label}</p>
      <p
        className={
          "text-xs break-all rounded-lg border px-3 py-2 font-mono " +
          (green ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-line bg-muted text-ink")
        }
      >
        {value}
      </p>
    </div>
  )
}

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = React.useState<Step>("ask")
  const [wizardStep, setWizardStep] = React.useState(0)
  const [checking, setChecking] = React.useState(false)
  const [status, setStatus] = React.useState<BotStatus | null>(null)
  const creds = loadCreds()

  React.useEffect(() => {
    if (!creds) router.replace("/register")
  }, [creds, router])

  if (!creds) return null

  async function verify() {
    const c = loadCreds()
    if (!c) return
    setChecking(true)
    setStatus(null)
    setStatus(await checkBotConnection(c))
    setChecking(false)
  }

  function renderWizardStep() {
    switch (wizardStep) {
      case 0:
        return (
          <BrowserMock url="https://developers.facebook.com/apps">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium m-0">My Apps</p>
              <MiniButton primary>＋ Create app</MiniButton>
            </div>
            <div className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-mut">
              Your new app appears here after creation
            </div>
            <div className="rounded-xl bg-[#1877F2]/5 border border-[#1877F2]/20 p-3 text-xs text-soft">
              Choose app type <b>Business</b> → name it (e.g. &quot;My Bot App&quot;) → <b>Create</b>. Development
              mode is fine.
            </div>
            <div className="flex items-center gap-2 text-xs text-soft">
              <KeyRound className="h-4 w-4 shrink-0 text-[#1877F2]" />
              Later you need <b>Settings → Basic</b> for the App ID &amp; App Secret.
            </div>
          </BrowserMock>
        )
      case 1:
        return (
          <BrowserMock url="https://developers.facebook.com/tools/explorer/">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium m-0">Graph API Explorer</p>
              <MiniButton primary>Get Page Access Token</MiniButton>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] text-mut">Your page token (starts with EAAB…)</p>
              <p className="text-xs font-mono break-all rounded-lg border border-line bg-muted px-3 py-2 select-all">
                EAABxxxxx…SGVsbG8tQ2hhdHJpWC1ib3QtNzI0NTY=
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-soft">
              <MessageCircle className="h-4 w-4 shrink-0 text-[#1877F2]" />
              Pick the app you created (top-right) so the token belongs to it, then choose your page.
            </div>
            <p className="text-[11px] text-mut m-0">
              Note: the token may expire after a couple of hours — if the bot ever stops replying, generate a fresh
              one and reconnect.
            </p>
          </BrowserMock>
        )
      case 2:
        return (
          <BrowserMock url="https://fb-autoreply-client.netlify.app/dashboard/pages">
            <p className="text-sm font-medium m-0">Option A — We host the app</p>
            <MiniField label="Page Access Token *" value="EAABxxxxx…SGVsbG8tQ2hhdHJpWC1ib3QtNzI0NTY=" />
            <MiniField label="App ID *" value="1234567890" />
            <MiniField label="App Secret *" value="••••••••••••••••" />
            <div>
              <MiniButton primary>
                <Link2 className="h-3 w-3" /> Connect Facebook Page
              </MiniButton>
            </div>
            <p className="text-[11px] text-mut m-0">
              Do this inside your dashboard — log in below, open <b>Page Connection</b> and follow the on-screen guide.
            </p>
          </BrowserMock>
        )
      case 3:
        return (
          <BrowserMock url="https://developers.facebook.com/apps → Messenger → Webhooks">
            <p className="text-sm font-medium m-0">Webhooks — Edit</p>
            <MiniField label="Callback URL" value={WEBHOOK_CALLBACK} />
            <MiniField label="Verify token" value="paste-the-green-token-from-your-dashboard" green />
            <div>
              <MiniButton primary>Save &amp; Verify</MiniButton>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              You should see: &quot;Webhooks are active for: Page&quot;
            </div>
            <p className="text-[11px] text-mut m-0">
              The green verify token is shown right after you connect your page in the dashboard.
            </p>
          </BrowserMock>
        )
      case 4:
        return (
          <div className="rounded-2xl border border-line bg-white shadow-lg overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line bg-muted px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
              <span className="ml-3 flex-1 truncate rounded-md bg-white border border-line px-3 py-1 text-[11px] text-mut">
                Messenger — your page
              </span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-start">
                <span className="max-w-[75%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-xs">
                  Hi, how much does your service cost? 🙂
                </span>
              </div>
              <div className="flex justify-end">
                <span className="max-w-[75%] rounded-2xl rounded-br-sm bg-[#1877F2] px-3 py-2 text-xs text-white">
                  Hi! Our Starter plan is $29/month — want me to walk you through it? 🤖
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Your page replies within a few seconds
              </div>
              <p className="text-[11px] text-mut m-0">
                Use a second Facebook account (in Development mode, add it as a <b>Tester</b> in App roles first).
              </p>
            </div>
          </div>
        )
      default:
        return (
          <div className="stack-md">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#1877F2]" />
              <p className="text-sm m-0">
                Done all the steps? Let&apos;s check whether your bot is live on Facebook.
              </p>
            </div>
            {!status && !checking && (
              <LoadingButton
                size="lg"
                variant="gradient"
                onClick={verify}
                rightIcon={<RefreshCw className="h-4 w-4" />}
              >
                Check my bot status
              </LoadingButton>
            )}
            {checking && (
              <div className="flex items-center gap-2 text-sm text-soft">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking your account on the server…
              </div>
            )}
            {status &&
              (status.connected ? (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 stack-sm">
                  <div className="flex items-center gap-2 text-emerald-700 font-medium">
                    <CheckCircle2 className="h-5 w-5" /> Bot connected — everything is live!
                  </div>
                  <p className="text-sm text-emerald-900 m-0">{status.message}</p>
                  <p className="text-xs text-emerald-800 m-0">
                    Page: <b>{status.page_name}</b> · Bot: <b>{status.bot_name}</b>
                  </p>
                  <LinkButton href={clientPanelLoginUrl()} variant="default" size="sm" rightIcon={<ExternalLink className="h-3.5 w-3.5" />}>
                    Open my dashboard
                  </LinkButton>
                </div>
              ) : (
                <div className="rounded-xl border border-red-300 bg-red-50 p-4 stack-sm">
                  <div className="flex items-center gap-2 text-red-700 font-medium">
                    <AlertCircle className="h-5 w-5" /> Bot is not connected yet
                  </div>
                  <p className="text-sm text-red-900 m-0">{status.message}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setWizardStep(2)}>
                      Go back to step 3
                    </Button>
                    <Button size="sm" onClick={() => window.location.href = clientPanelLoginUrl()}>
                      Open my dashboard & connect
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        )
    }
  }

  function renderWizard() {
    return (
      <div className="stack-lg">
        <div className="flex items-center gap-3">
          {STEP_TITLES.map((t, i) => (
            <div key={t} className="flex-1">
              <div
                className={
                  "h-1.5 rounded-full transition-colors " +
                  (i <= wizardStep ? "bg-gradient-to-r from-primary to-[#9333EA]" : "bg-muted")
                }
              />
              <p className={"mt-1 text-[10px] truncate " + (i === wizardStep ? "text-ink font-medium" : "text-mut")}>
                {i + 1}. {t}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2 items-start">
          <div>{renderWizardStep()}</div>
          <div className="stack-lg">
            <div className="flex items-center gap-2">
              <span className="brand-mark"><MessagesSquare className="h-5 w-5" /></span>
              <h3 className="h3 m-0">Step {wizardStep + 1} — {STEP_TITLES[wizardStep]}</h3>
            </div>
            {wizardStep === 0 && (
              <div className="stack-sm text-sm text-soft">
                <p className="m-0">This app is the technical bridge between your page and our system. It takes about 5 minutes, once.</p>
                <a className="ulink inline-flex items-center gap-1" href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer">
                  Open developers.facebook.com/apps <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
            {wizardStep === 1 && (
              <div className="stack-sm text-sm text-soft">
                <p className="m-0">This token lets our bot read and reply on your page. Copy it — you&apos;ll paste it in your dashboard.</p>
                <a className="ulink inline-flex items-center gap-1" href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer">
                  Open the Graph API Explorer <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
            {wizardStep === 2 && (
              <div className="stack-sm text-sm text-soft">
                <p className="m-0">Log in to your dashboard and paste the token + App ID + App Secret on the <b>Page Connection</b> screen, then click Connect.</p>
                <LinkButton href={clientPanelLoginUrl()} variant="default" size="sm" rightIcon={<ExternalLink className="h-3.5 w-3.5" />}>
                  Log in to my dashboard
                </LinkButton>
              </div>
            )}
            {wizardStep === 3 && (
              <div className="stack-sm text-sm text-soft">
                <p className="m-0">Paste the <b>green verify token</b> (shown after connecting in your dashboard) into your app&apos;s webhook settings, with the callback URL above.</p>
              </div>
            )}
            {wizardStep === 4 && (
              <div className="stack-sm text-sm text-soft">
                <p className="m-0">Message your page from a second Facebook account. Your bot should answer on your page&apos;s behalf within seconds.</p>
              </div>
            )}
            {wizardStep === 5 && (
              <div className="stack-sm text-sm text-soft">
                <p className="m-0">We check with our server whether your page is connected to your account. If something is missing, we&apos;ll show you exactly where.</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              {wizardStep > 0 && (
                <Button variant="outline" onClick={() => setWizardStep((s) => s - 1)} leftIcon={<ArrowLeft className="h-4 w-4" />}>
                  Back
                </Button>
              )}
              {wizardStep < STEP_TITLES.length - 1 && (
                <Button
                  variant="gradient"
                  onClick={() => setWizardStep((s) => s + 1)}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Next
                </Button>
              )}
              {wizardStep < STEP_TITLES.length - 1 && (
                <Button variant="ghost" size="sm" onClick={() => setWizardStep(STEP_TITLES.length - 1)}>
                  Skip to check
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className="section bg-surface-2">
      <div className="container-x">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto stack-md">
            <p className="eyebrow">Step 3 of 3</p>
            <h1 className="h2 mt-2">Configure your bot</h1>
            <p className="text-soft">Account: <b>{creds.email}</b></p>
          </div>
        </Reveal>

        <Reveal>
          <div className="max-w-4xl mx-auto mt-10 stack-lg">
            {step === "ask" && (
              <div className="auth-card stack-lg mx-auto">
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
                  <Button size="lg" variant="gradient" onClick={() => setStep("wizard")}>
                    Yes, I have one
                  </Button>
                </div>
              </div>
            )}

            {step === "creating" && (
              <div className="auth-card stack-lg mx-auto">
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
                  <Button size="lg" variant="gradient" onClick={() => setStep("wizard")}>
                    I've created my page
                  </Button>
                </div>
              </div>
            )}

            {step === "wizard" && renderWizard()}
          </div>
        </Reveal>
      </div>
    </section>
  )
}