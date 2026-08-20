"use client"

import { Suspense, useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { adminApi } from "@/lib/api"
import { useAdminAuth } from "@/lib/auth-context"
import { CheckCircle2, Copy, Fingerprint, KeyRound, Loader2, PlugZap, UserPlus, Wand2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const STEPS = ["Client", "Connect", "Done"]

export default function ProvisionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
      <ProvisionWizard />
    </Suspense>
  )
}

function ProvisionWizard() {
  const router = useRouter()
  const { user, loading: authLoading } = useAdminAuth()
  const [authed, setAuthed] = useState(false)

  const routerRef = useRef(router)
  routerRef.current = router

  const [step, setStep] = useState(0)
  const [error, setError] = useState("")

  const [clientEmail, setClientEmail] = useState("")
  const [clientName, setClientName] = useState("")
  const [creating, setCreating] = useState(false)
  const [newClientId, setNewClientId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState<string | null>(null)

  const [appId, setAppId] = useState("")
  const [appSecret, setAppSecret] = useState("")
  const [token, setToken] = useState("")
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState<{ id: string; page_id: string; page_name: string; callback_url: string; verify_token: string } | null>(null)

  const [copied, setCopied] = useState<"email" | "url" | "token" | "creds" | null>(null)

  const copy = useCallback(async (key: "email" | "url" | "token" | "creds", text: string) => {
    try { await navigator.clipboard.writeText(text) } catch { /* noop */ }
    setCopied(key)
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000)
  }, [])

  if (!authLoading && !user) routerRef.current.push("/login")
  if (authLoading || !user) return null

  const createClient = async () => {
    if (!clientEmail.trim()) { setError("Enter the client's email."); return }
    setCreating(true); setError("")
    try {
      const r = await adminApi.createUser({ email: clientEmail.trim(), full_name: clientName.trim() || null })
      setNewClientId(r.id)
      setNewPassword(r.password || null)
      setStep(1)
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to create client") }
    finally { setCreating(false) }
  }

  const saveAppCreds = async () => {
    if (!newClientId) return
    if (!appId.trim() || !appSecret.trim() || !token.trim()) {
      setError("Fill in the App ID, App Secret and Access Token.")
      return
    }
    setSaving(true); setError(""); setSaved(null)
    try {
      const r = await adminApi.provisionConnectApp(newClientId, {
        fb_app_id: appId.trim(),
        fb_app_secret: appSecret.trim(),
        page_access_token: token.trim(),
      })
      setSaved(r)
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save app credentials") }
    finally { setSaving(false) }
  }

  const testConnection = async () => {
    if (!saved) return
    setTesting(true); setError("")
    try {
      await adminApi.provisionTestConnection(saved.id)
      setStep(2)
    } catch (e) { setError(e instanceof Error ? e.message : "Test failed") }
    finally { setTesting(false) }
  }

  const reset = () => {
    setStep(0); setError("")
    setClientEmail(""); setClientName(""); setNewClientId(null); setNewPassword(null)
    setAppId(""); setAppSecret(""); setToken(""); setSaved(null); setCopied(null)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
          <Wand2 className="w-6 h-6 text-primary" /> Configure a new bot
        </h1>
        <p className="text-sm text-muted-foreground">
          Create the client, save their Meta app credentials, hand over the webhook values, verify, and deliver credentials.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6 text-sm">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${i <= step ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}>
              {i < step ? <CheckCircle2 className="w-4 h-4" /> : <span>{i + 1}</span>}
              {s}
            </div>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-border" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {step === 0 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary" /> Client details</h3>
            <p className="text-sm text-muted-foreground">Enter the client's info. A unique password is auto-generated and delivered at the end.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Client email (dashboard username)</Label>
                <Input type="email" placeholder="client@example.com" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Full name (optional)</Label>
                <Input placeholder="Jane Doe" value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" disabled={creating || !clientEmail.trim()} onClick={createClient}>
                {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1" />}
                {creating ? "Creating…" : "Create client & continue"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><Fingerprint className="w-5 h-5 text-primary" /> Connect the bot to the customer's Meta app</h3>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1.5">
                <li>Ask the customer to create their Meta app, add the <b>Messenger</b> product and connect their Facebook page (Development mode is fine for setup).</li>
                <li>Have them open <b>App Dashboard → Settings → Basic</b> and copy the <b>App ID</b> and <b>App Secret</b> (click Show).</li>
                <li>Have them open <b>App Dashboard → Messenger → Access Tokens</b> and generate / copy the <b>Page Access Token</b> for their page.</li>
                <li>Paste the three values below and click <b>Save credentials</b> — we generate the webhook values to hand to the customer.</li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label className="text-xs">App ID</Label>
                  <Input placeholder="1234567890" value={appId} onChange={(e) => setAppId(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">App Secret</Label>
                  <Input type="password" placeholder="From Meta App Dashboard → Settings → Basic" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Page Access Token</Label>
                  <Input type="password" placeholder="EAAB…" value={token} onChange={(e) => setToken(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm" disabled={saving} onClick={saveAppCreds}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <KeyRound className="w-4 h-4 mr-1" />}
                  {saving ? "Saving…" : "Save credentials"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {saved && (
            <>
              <Card className="border-primary/40">
                <CardContent className="p-5 space-y-4">
                  <div className="rounded-lg border p-3 flex items-center gap-2 text-sm bg-muted/40">
                    <PlugZap className="w-4 h-4 text-primary" />
                    <span className="font-medium">{saved.page_name}</span>
                    <span className="text-muted-foreground text-xs">({saved.page_id})</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Send these <b>two values</b> to the customer and ask them to open <b>Meta App Dashboard → Messenger →
                    Webhooks</b>, add a callback, paste both values, verify, then subscribe their page. Once they confirm,
                    click <b>Test Connection</b>.
                  </p>
                  <div>
                    <Label className="text-xs">Callback URL</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded break-all select-all">{saved.callback_url}</code>
                      <Button size="sm" variant="outline" onClick={() => copy("url", saved.callback_url)}>
                        <Copy className="w-3.5 h-3.5" />{copied === "url" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Webhook verify token</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded break-all select-all">{saved.verify_token}</code>
                      <Button size="sm" variant="outline" onClick={() => copy("token", saved.verify_token)}>
                        <Copy className="w-3.5 h-3.5" />{copied === "token" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Note: the App Secret is never shown again after this screen — it is stored only to verify incoming
                    messages. If the page token expires, ask the customer for a fresh one and save the credentials again.
                  </p>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button disabled={testing} onClick={testConnection}>
                  {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlugZap className="w-4 h-4 mr-2" />}
                  {testing ? "Testing…" : "Test connection"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" /> Connected &amp; verified — deliver these credentials
            </h3>
            <p className="text-sm text-muted-foreground">
              The webhook is receiving events and the page token is valid. The customer signs in at{" "}
              <span className="font-mono text-xs">https://fb-autoreply-client.netlify.app</span> with the email and password below.
            </p>
            <div className="rounded-lg border p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Username / email</p>
                <p className="font-mono text-sm">{clientEmail}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Unique password</p>
                <p className="font-mono text-sm">{newPassword}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => copy("creds", `${clientEmail}\n${newPassword}`)}>
                <Copy className="w-4 h-4 mr-1" /> {copied === "creds" ? "Copied!" : "Copy email + password"}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={reset}>
                Configure another bot
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}