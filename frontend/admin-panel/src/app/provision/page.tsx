"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { adminApi } from "@/lib/api"
import { useAdminAuth } from "@/lib/auth-context"
import {
  Bot, CheckCircle2, Copy, ExternalLink, Fingerprint, KeyRound, Loader2, ScanSearch,
  UserPlus, Wand2,
} from "lucide-react"
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

  const [token, setToken] = useState("")
  const [pageList, setPageList] = useState<any[]>([])
  const [connecting, setConnecting] = useState(false)
  const [fbBusy, setFbBusy] = useState(false)
  const [fbState, setFbState] = useState("")
  const [connectedPage, setConnectedPage] = useState<any>(null)
  const [scanning, setScanning] = useState(false)

  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) routerRef.current.push("/login")
    else setAuthed(true)
  }, [authLoading, user])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    const state = params.get("state")
    if (!code || !state || !newClientId || fbBusy) return
    window.opener?.postMessage({ source: "chatrix-provision", code, state }, "*")
  }, [newClientId, fbBusy])

  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      const d = e.data
      if (!d || d.source !== "chatrix-provision" || !d.code || !d.state) return
      if (!newClientId) return
      if (d.state !== fbState) { setError("Facebook state mismatch — start again."); return }
      setFbBusy(true); setError("")
      try {
        const r = await adminApi.provisionFbComplete(newClientId, d.code, d.state)
        setPageList(r.pages.map((p: any) => ({ id: p.page_id, name: p.page_name })))
      } catch (e) { setError(e instanceof Error ? e.message : "Facebook sign-in failed") }
      finally { setFbBusy(false) }
    }
    window.addEventListener("message", onMsg)
    return () => window.removeEventListener("message", onMsg)
  }, [newClientId, fbState])

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

  const findPages = async () => {
    if (!newClientId || !token.trim()) { setError("Paste the page token first."); return }
    setConnecting(true); setError("")
    try {
      const r = await adminApi.provisionFindPages(newClientId, token.trim())
      setPageList((r.pages || []).map((p: any) => ({ id: p.page_id || p.id, name: p.page_name || p.name })))
      if (!r.pages?.length) setError("No pages found for that token.")
    } catch (e) { setError(e instanceof Error ? e.message : "Token lookup failed") }
    finally { setConnecting(false) }
  }

  const connectPage = async (pageId: string) => {
    if (!newClientId || !token.trim()) return
    setConnecting(true); setError("")
    try {
      const r = await adminApi.provisionConnectPage(newClientId, { access_token: token.trim(), page_id: pageId })
      setConnectedPage(r); setPageList([])
    } catch (e) { setError(e instanceof Error ? e.message : "Connect failed") }
    finally { setConnecting(false) }
  }

  const beginFbLogin = async () => {
    if (!newClientId) return
    setFbBusy(true); setError("")
    try {
      const r = await adminApi.provisionFbAuthorize(newClientId)
      setFbState(r.state)
      window.open(r.auth_url, "_blank", "width=600,height=750")
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to start Facebook sign-in"); setFbBusy(false) }
  }

  const pickFbPage = async (pageId: string) => {
    if (!newClientId) return
    setFbBusy(true); setError("")
    try {
      const r = await adminApi.provisionFbSelect(newClientId, pageId)
      setConnectedPage(r); setPageList([])
    } catch (e) { setError(e instanceof Error ? e.message : "Page attach failed") }
    finally { setFbBusy(false) }
  }

  const runScanAndDeliver = async () => {
    if (!connectedPage?.id) return
    setScanning(true); setError("")
    try {
      await adminApi.provisionUpdateConfig(connectedPage.id, {
        bot_tone: "professional_friendly",
        language_mode: "auto",
        system_prompt: null,
        auto_handover_after: 6,
      })
      await adminApi.provisionScan(connectedPage.id)
      setStep(2)
    } catch (e) { setError(e instanceof Error ? e.message : "Scan failed") }
    finally { setScanning(false) }
  }

  const copyCreds = async () => {
    await navigator.clipboard.writeText(`${clientEmail}\n${newPassword}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (authLoading || !authed) return null

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
          <Wand2 className="w-6 h-6 text-primary" /> Configure a new bot
        </h1>
        <p className="text-sm text-muted-foreground">
          Create the client, connect their Facebook page, the bot trains itself — hand over credentials.
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
            <p className="text-sm text-muted-foreground">Enter the client's info. A password will be auto-generated.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Client email</Label>
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
          <p className="text-sm text-muted-foreground">
            Client created. Now connect their Facebook page — the bot will auto-train from it.
          </p>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2"><Fingerprint className="w-5 h-5 text-primary" /> Owner signs into Facebook</h3>
                  <p className="text-sm text-muted-foreground">Preferred — the page owner opens Facebook in a pop-up and approves access.</p>
                </div>
                <Button size="sm" variant="outline" disabled={fbBusy} onClick={beginFbLogin}>
                  {fbBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-1" />}
                  {fbBusy ? "Waiting…" : "Connect with Facebook"}
                </Button>
              </div>
              {!fbBusy && pageList.length > 0 && (
                <div className="mt-4 space-y-2">
                  {pageList.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm font-medium">{p.name}</span>
                      <Button size="sm" disabled={fbBusy} onClick={() => pickFbPage(p.id)}>Attach this page</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 text-muted-foreground text-xs">
            <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
          </div>

          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" /> Paste a page access token</h3>
              <p className="text-sm text-muted-foreground">
                Ask the client to open the{" "}
                <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">Facebook Graph API Explorer</a>,{" "}
                select their app, grant <code className="text-xs bg-muted px-1 py-0.5 rounded">pages_manage_metadata</code> and <code className="text-xs bg-muted px-1 py-0.5 rounded">pages_read_engagement</code> permissions, then copy the <strong>Page Access Token</strong>.
              </p>
              <div className="flex gap-2">
                <Input type="password" placeholder="EAA…" value={token} onChange={(e) => { setToken(e.target.value); setPageList([]) }} />
                <Button size="sm" variant="outline" disabled={connecting || !token.trim()} onClick={findPages}>
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Find pages"}
                </Button>
              </div>
              {pageList.length > 0 && (
                <div className="space-y-2">
                  {pageList.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm font-medium">{p.name}</span>
                      <Button size="sm" disabled={connecting} onClick={() => connectPage(p.id)}>Connect</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {connectedPage && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="rounded-lg border p-3 flex items-center gap-2 text-sm">
                  <Bot className="w-5 h-5 text-primary" />
                  <span className="font-medium">{connectedPage.page_name}</span>
                  <span className="text-muted-foreground text-xs">({connectedPage.page_id})</span>
                </div>
                <p className="text-sm text-muted-foreground">Page connected. The bot will auto-train from the page info, posts, and linked website.</p>
                <Button size="sm" disabled={scanning} onClick={runScanAndDeliver}>
                  {scanning ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ScanSearch className="w-4 h-4 mr-1" />}
                  {scanning ? "Training bot…" : "Train bot & finish"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {step === 2 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" /> Bot is live!
            </h3>
            <p className="text-sm text-muted-foreground">
              The bot is trained and active on the client's page. Send them these credentials — they sign in at the client panel and everything works.
            </p>
            <div className="rounded-lg border p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Email</p>
                <p className="font-mono text-sm">{clientEmail}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Password</p>
                <p className="font-mono text-sm">{newPassword}</p>
              </div>
              <Button size="sm" variant="outline" onClick={copyCreds}>
                <Copy className="w-4 h-4 mr-1" /> {copied ? "Copied!" : "Copy email + password"}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => {
                setStep(0); setClientEmail(""); setClientName(""); setNewClientId(null); setNewPassword(null)
                setConnectedPage(null); setToken(""); setPageList([]); setFbState("")
              }}>
                Configure another bot
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
