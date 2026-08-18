"use client"

/**
 * register/page.tsx — account creation for a new facebook page bot.
 * Posts to the backend /api/client/auth/register, then points the
 * user to the client panel to log in and connect their page.
 */
import * as React from "react"
import Link from "next/link"
import { ArrowRight, Bot, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton, LinkButton, buttonVariants } from "@/components/ui/button"
import { Reveal } from "@/components/reveal"
import { LiveChatDemo } from "@/components/live-chat-demo"
import { registerClientUser, clientPanelLoginUrl } from "@/lib/api"
import { SITE } from "@/lib/site"
import { usePathname } from "next/navigation"

type Errors = { full_name?: string; email?: string; password?: string; form?: string }

export default function RegisterPage() {
  const [fullName, setFullName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [errors, setErrors] = React.useState<Errors>({})
  const [loading, setLoading] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const pathname = usePathname()

  function validate(): boolean {
    const e: Errors = {}
    if (!fullName.trim()) e.full_name = "Please enter your name"
    if (!email.trim()) e.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email"
    if (!password) e.password = "Password is required"
    else if (password.length < 8) e.password = "Use at least 8 characters"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setLoading(true)
    setErrors({})
    const res = await registerClientUser({ full_name: fullName, email, password })
    setLoading(false)
    if (res.ok) {
      setDone(true)
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
              {done ? (
                <div className="stack-lg text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h2 className="h3">Account ready 🎉</h2>
                  <p className="text-soft">
                    Your ChatriX account for <b>{email}</b> is created. Use these credentials to log in to your
                    dashboard and connect your first Facebook page.
                  </p>
                  <LinkButton href={clientPanelLoginUrl()} variant="gradient" size="lg" fullWidth rightIcon={<ArrowRight className="h-4 w-4" />}>
                    Go to your dashboard
                  </LinkButton>
                  <Link href="/features" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    Explore features first
                  </Link>
                </div>
              ) : (
                <form onSubmit={onSubmit} noValidate className="stack-lg">
                  <div className="flex items-center gap-2">
                    <span className="brand-mark"><Bot className="h-5 w-5" /></span>
                    <h2 className="h3 m-0">Create your account</h2>
                  </div>

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

                  <div className="field">
                    <Label htmlFor="password" required>Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      invalid={!!errors.password}
                      autoComplete="new-password"
                    />
                    {errors.password ? (
                      <span className="field-error">Use at least 8 characters</span>
                    ) : (
                      <span className="field-hint">Use at least 8 characters</span>
                    )}
                  </div>

                  <LoadingButton type="submit" variant="gradient" size="lg" fullWidth loading={loading}>
                    Register a AI moderator for your page
                  </LoadingButton>

                  <p className="text-center text-xs text-mut">
                    By registering you agree to our Terms. No credit card required.
                  </p>
                  <p className="text-center text-sm text-soft">
                    Already have an account?{" "}
                    <Link href={SITE.clientPanelUrl} className="ulink">Log in</Link>
                  </p>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}