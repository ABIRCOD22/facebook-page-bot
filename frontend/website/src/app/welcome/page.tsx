"use client"

/**
 * welcome/page.tsx — end of the onboarding funnel. Hands out the
 * dashboard credentials (email + system-generated password) and links
 * to the client login page. Credentials are shown once, then cleared.
 */
import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, CheckCircle2, Copy, KeyRound, ShieldCheck } from "lucide-react"
import { Button, LinkButton } from "@/components/ui/button"
import { Reveal } from "@/components/reveal"
import { loadCreds, clearCreds, clientPanelLoginUrl } from "@/lib/api"

export default function WelcomePage() {
  const router = useRouter()
  const [copied, setCopied] = React.useState<"email" | "password" | null>(null)
  const creds = loadCreds()

  React.useEffect(() => {
    if (!creds) router.replace("/register")
  }, [creds, router])

  if (!creds) return null

  function copy(which: "email" | "password") {
    const value = loadCreds()?.[which] ?? ""
    navigator.clipboard?.writeText(value).catch(() => {})
    setCopied(which)
    setTimeout(() => setCopied(null), 1500)
  }

  function finish() {
    const c = loadCreds()
    clearCreds()
    window.location.href = clientPanelLoginUrl(c ?? undefined)
  }

  return (
    <section className="section bg-surface-2">
      <div className="container-x">
        <Reveal>
          <div className="auth-card text-center stack-lg">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="h2 m-0">You&apos;re all set! 🎉</h1>
            <p className="text-soft m-0">
              Your bot account is ready. Save these credentials — they are shown <b>only once</b>.
            </p>

            <div className="rounded-xl border border-line p-4 stack-sm text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm text-soft">
                  <KeyRound className="h-4 w-4" /> Email / username
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copy("email")}
                  aria-label="Copy email"
                >
                  <Copy className="h-3.5 w-3.5" /> {copied === "email" ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="m-0 text-sm font-medium break-all select-all bg-muted rounded-lg px-3 py-2">{creds.email}</p>

              <div className="flex items-center justify-between gap-2 mt-2">
                <span className="flex items-center gap-2 text-sm text-soft">
                  <ShieldCheck className="h-4 w-4" /> Password
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copy("password")}
                  aria-label="Copy password"
                >
                  <Copy className="h-3.5 w-3.5" /> {copied === "password" ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="m-0 text-sm font-mono break-all select-all bg-muted rounded-lg px-3 py-2">{creds.password}</p>
            </div>

            <p className="text-xs text-mut m-0">
              Your dashboard will now guide you step by step: connect your Facebook page, run a business scan and
              your bot starts replying 24/7.
            </p>

            <Button size="lg" variant="gradient" fullWidth onClick={finish} rightIcon={<ArrowRight className="h-4 w-4" />}>
              Go to my dashboard & log in
            </Button>

            <p className="text-sm text-soft m-0">
              Client login page:{" "}
              <a href={clientPanelLoginUrl(creds)} className="ulink">{clientPanelLoginUrl(creds)}</a>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}