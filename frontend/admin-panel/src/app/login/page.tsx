"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAdminAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, Loader2, KeyRound } from "lucide-react"

export default function LoginPage() {
  const { login, verify2fa, twoFactor } = useAdminAuth()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const r = await login(email, password)
      if (!r.requires2fa) router.push("/admin")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await verify2fa(code)
      router.push("/admin")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            ChatriX Admin
          </span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{twoFactor ? "Two-Factor Authentication" : "Super Admin Sign In"}</CardTitle>
            <CardDescription>
              {twoFactor
                ? "Enter the 6-digit code from your authenticator app."
                : "Access the control center for all users and bots."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 text-destructive text-sm px-3 py-2">
                {error}
              </div>
            )}

            {!twoFactor ? (
              <form onSubmit={submitPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@yourbrand.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Continue
                </Button>
              </form>
            ) : (
              <form onSubmit={submitCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Authentication Code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    className="text-center text-lg tracking-[0.5em]"
                    maxLength={6}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  Verify & Sign In
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
