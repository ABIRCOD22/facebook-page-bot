"use client"

/**
 * register/page.tsx — step 1 of the onboarding funnel. The user gives an
 * email only; the account is created with a system-generated password and
 * the funnel continues to /checkout. Credentials are handed out on /welcome.
 */
import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bot, AlertCircle, ShieldCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/button"
import { Reveal } from "@/components/reveal"
import { LiveChatDemo } from "@/components/live-chat-demo"
import { registerClientUser, generatePassword, saveCreds, clientPanelLoginUrl } from "@/lib/api"
import { SITE } from "@/lib/site"

type Errors = { full_name?: string; email?: string; form?: string }

export default function RegisterPage() {
  const [fullName, setFullName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [errors, setErrors] = React.useState<Errors>({})
  const [loading, setLoading] = React.useState(false)
  const router = useRouter()

  function validate(): boolean {
    const e: Errors = {}
    if (!fullName.trim()) e.full_name = "Please enter your name"
    if (!email.trim()) e.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setLoading(true)
    setErrors({})
    const password = generatePassword()
    const res = await registerClientUser({ full_name: fullName, email, password })
    setLoading(false)
    if (res.ok) {
      saveCreds({ email, password })
      router.replace("/checkout")
    } else {
      setErrors({ form: res.message || "Could not create your account. Please try again." })
    }
  }

  return (
    <section className="section bg-surface-2">
      <div className="container-x">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Left: visual demo */}
          <div>
            <LiveChatDemo />
          </div>

          {/* Right: form */}
          <Reveal>
            <div className="auth-card">
              <form onSubmit={onSubmit} noValidate className="stack-lg">
                <div className="flex items-center gap-2">
                  <span className="brand-mark"><Bot className="h-5 w-5" /></span>
                  <h2 className="h3 m-0">Create your account</h2>
                </div>
                <p className="text-sm text-soft m-0">
                  Step 1 of 3 — takes 10 seconds. Your dashboard credentials are generated and shown at the end.
                </p>

                {errors.form ? (
                  <div className="notice notice-error">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errors.form}</span>
                  </div>
                ) : null}

                <div className="field">
                  <Label htmlFor="full_name" required>Full name</Label>
                  <Input
                    id="full_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Page Owner"
                    invalid={!!errors.full_name}
                    autoComplete="name"
                  />
                  {errors.full_name ? <span className="field-error">{errors.full_name}</span> : null}
                </div>

                <div className="field">
                  <Label htmlFor="email" required>Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@business.com"
                    invalid={!!errors.email}
                    autoComplete="email"
                  />
                  {errors.email ? <span className="field-error">{errors.email}</span> : null}
                </div>

                <LoadingButton type="submit" variant="gradient" size="lg" fullWidth loading={loading}>
                  Continue — choose your plan
                </LoadingButton>

                <p className="text-center text-xs text-mut">
                  By registering you agree to our Terms. No credit card required.
                </p>
                <p className="text-center text-sm text-soft">
                  Already have an account?{" "}
                  <Link prefetch={false} href={SITE.clientPanelUrl} className="ulink">Log in</Link>
                </p>
                <p className="flex items-center justify-center gap-1.5 text-center text-xs text-mut">
                  <ShieldCheck className="h-3.5 w-3.5" /> Step 2: pick a plan — Step 3: configure your bot
                </p>
              </form>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}