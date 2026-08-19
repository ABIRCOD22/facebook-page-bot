"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { adminApi } from "@/lib/api"
import { useAdminAuth } from "@/lib/auth-context"
import {
  Bot, CheckCircle2, Copy, ExternalLink, Fingerprint, KeyRound, Loader2, Save, ScanSearch,
  UserPlus, Users, Wand2,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const TONES = [
  { value: "professional_friendly", label: "Professional & friendly" },
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "witty", label: "Witty" },
]
const LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "en_only", label: "English only" },
  { value: "bn_only", label: "Bangla only" },
  { value: "bilingual", label: "Bilingual EN + BN" },
]

const STEPS = ["User", "Connect", "Configure", "Scan & deliver"]

export default function ProvisionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
      <ProvisionWizard />
    </Suspense>
  )
}

function ProvisionWizard() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAdminAuth()
  const [authed, setAuthed] = useState(false)

  // step 1: pick the target client account
  const [users, setUsers] = useState<any[]>([])
  const [userId, setUserId] = useState("")
  const [userEmail, setUserEmail] = useState("")

  // step 2: connect — paste token OR owner fb login
  const [token, setToken] = useState("")
  const [pageList, setPageList] = useState<any[]>([])
  const [connecting, setConnecting] = useState(false)
  const [fbBusy, setFbBusy] = useState(false)
  const [fbState, setFbState] = useState("")
  const [connectedPage, setConnectedPage] = useState<any>(null)

  // step 3: bot config
  const [tone, setTone] = useState("professional_friendly")
  const [language, setLanguage] = useState("auto")
  const [prompt, setPrompt] = useState("")
  const [handoverAfter, setHandoverAfter] = useState(6)
  const [saving, setSaving] = useState(false)

  // step 4: scan + deliver
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [generatedPw, setGeneratedPw] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState("")

  useEffect(() => {
    if (authLoading) return
    if (!user) router.push("/login")
    else setAuthed(true)
  }, [authLoading, user, router])

  const loadUsers = useCallback(async () => {
    try {
      const r = await adminApi.getUsers(undefined, 200, 0)
      setUsers(r.users)
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load users") }
  }, [])

  useEffect(() => { if (authed) loadUsers() }, [authed, loadUsers])

  // FB callback: owner approved in the popup, redirected here with ?code&state
  useEffect(() => {
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    if (!code || !state || !userId || fbBusy) return
    window.opener?.postMessage({ source: "chatrix-provision", code, state }, "*")
  }, [searchParams, userId, fbBusy])

  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      const d = e.data
      if (!d || d.source !== "chatrix-provision" || !d.code || !d.state) return
      if (d.state !== fbState) { setError("Facebook state mismatch — start the sign-in again."); return }
      setFbBusy(true)
      setError("")
      try {
        const r = await adminApi.provisionFbComplete(userId, d.code, d.state)
        setPageList(r.pages.map((p) => ({ id: p.page_id, name: p.page_name })))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Facebook sign-in failed")
      } finally { setFbBusy(false) }
    }
    window.addEventListener("message", onMsg)
    return () => window.removeEventListener("message", onMsg)
  }, [userId, fbState])

  if (!authed) return null

  const beginFbLogin = async () => {
    if (!userId) return
    setFbBusy(true)
    setError("")
    try {
      const r = await adminApi.provisionFbAuthorize(userId)
      setFbState(r.state)
      localStorage.setItem(`prov_state_${r.state}`, userId)
      const w = window.open(r.auth_url, "_blank", "width=600,height=750")
      if (!w) { setError("Pop-up blocked — allow pop-ups for this site."); setFbBusy(false) }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start Facebook sign-in")
      setFbBusy(false)
    }
  }

  const findPages = async () => {
    if (!userId || !token.trim()) { setError("Pick a user and paste the page token first."); return }
    setConnecting(true); setError("")
    try {
      const r = await adminApi.provisionFindPages(userId, token.trim())
      setPageList((r.pages || []).map((p) => ({ id: p.page_id || p.id, name: p.page_name || p.name })))
      if (!r.pages?.length) setError("No pages found for that token.")
    } catch (err) { setError(err instanceof Error ? err.message : "Token lookup failed") }
    finally { setConnecting(false) }
  }

  const connectPage = async (pageId: string) => {
    if (!userId || !token.trim()) return
    setConnecting(true); setError("")
    try {
      const r = pageId
        ? await adminApi.provisionConnectPage(userId, { access_token: token.trim(), page_id: pageId })
        : await adminApi.provisionConnectPage(userId, { access_token: token.trim() })
      setConnectedPage(r); setStep(2)
    } catch (err) { setError(err instanceof Error ? err.message : "Connect failed") }
    finally { setConnecting(false) }
  }

  const pickFbPage = async (pageId: string) => {
    if (!userId) return
    setFbBusy(true); setError("")
    try {
      const r = await adminApi.provisionFbSelect(userId, pageId)
      setConnectedPage(r); setPageList([]); setStep(2)
    } catch (err) { setError(err instanceof Error ? err.message : "Page attach failed") }
    finally { setFbBusy(false) }
  }

  const saveConfig = async () => {
    if (!connectedPage?.id) return
    setSaving(true); setError("")
    try {
      await adminApi.provisionUpdateConfig(connectedPage.id, {
        bot_tone: tone,
        language_mode: language,
        system_prompt: prompt.trim() || null,
        auto_handover_after: handoverAfter,
      })
      setStep(3)
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed") }
    finally { setSaving(false) }
  }

  const runScan = async () => {
    if (!connectedPage?.id) return
    setScanning(true); setError("")
    try {
      const r = await adminApi.provisionScan(connectedPage.id)
      setScanResult(r)
    } catch (err) { setError(err instanceof Error ? err.message : "Scan failed") }
    finally { setScanning(false) }
  }

  const resetPw = async () => {
    if (!userId) return
    setResetting(true); setError("")
    try {
      const r = await adminApi.provisionResetPassword(userId)
      setGeneratedPw(r.password)
    } catch (err) { setError(err instanceof Error ? err.message : "Reset failed") }
    finally { setResetting(false) }
  }

  const copyCreds = async () => {
    await navigator.clipboard.writeText(`${userEmail}\n${generatedPw}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
          <Wand2 className="w-6 h-6 text-primary" /> Configure a new bot
        </h1>
        <p className="text-sm text-muted-foreground">
          White-glove setup: pick the client, connect their page (token paste or their Facebook Login), tune the bot, scan &amp; the bot trains itself — then hand over credentials.
        </p>
      </div>

      {/* stepper */}
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
            <div>
              <Label className="text-xs">Which client is this bot for?</Label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value)
                  const u = users.find((x) => x.id === e.target.value)
                  setUserEmail(u?.email || "")
                }}
              >
                <option value="">Select a client account…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.email} {u.full_name ? `(${u.full_name})` : ""}</option>
                ))}
              </select>
            </div>
            {userEmail && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" /> Provisioning for <span className="font-medium text-foreground">{userEmail}</span>
              </p>
            )}
            <div className="flex justify-end">
              <Button size="sm" disabled={!userId} onClick={() => setStep(1)}>
                <UserPlus className="w-4 h-4 mr-1" /> Continue to connect
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <div className="space-y-6">
          {/* FB login path */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2"><Fingerprint className="w-5 h-5 text-primary" /> Owner approves via Facebook Login</h3>
                  <p className="text-sm text-muted-foreground">Preferred — the page owner signs into Facebook in a pop-up (with their permission and credentials, done together). You pick which page to attach.</p>
                </div>
                <Button size="sm" variant="outline" disabled={fbBusy || !userId} onClick={beginFbLogin}>
                  {fbBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-1" />}
                  {fbBusy ? "Waiting for owner…" : "Connect with Facebook"}
                </Button>
              </div>

              {!fbBusy && pageList.length > 0 && (
                <div className="mt-4 space-y-2">
                  {pageList.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm font-medium">{p.name}</span>
                      <Button size="sm" disabled={fbBusy} onClick={() => pickFbPage(p.id)}>
                        Attach this page
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 text-muted-foreground text-xs">
            <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
          </div>

          {/* token paste path */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" /> Client brought an app ID + token</h3>
              <div>
                <Label className="text-xs">Page / user access token</Label>
                <div className="flex gap-2 mt-1">
                  <Input type="password" placeholder="EAA…" value={token}
                    onChange={(e) => { setToken(e.target.value); setPageList([]) }} />
                  <Button size="sm" variant="outline" disabled={connecting || !token.trim()} onClick={findPages}>
                    {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Find pages"}
                  </Button>
                </div>
              </div>
              {pageList.length > 0 && (
                <div className="space-y-2">
                  {pageList.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm font-medium">{p.name}</span>
                      <Button size="sm" disabled={connecting} onClick={() => connectPage(p.id)}>
                        Connect
                      </Button>
                    </div>
                  ))}
                  {pageList.length === 1 && (
                    <Button size="sm" variant="ghost" disabled={connecting} onClick={() => connectPage(pageList[0].id)}>
                      Connect the only page
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {connectedPage && (
            <Button variant="outline" size="sm" onClick={() => setStep(2)}>Skip — already connected → configure</Button>
          )}
        </div>
      )}

      {step === 2 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            {connectedPage && (
              <div className="rounded-lg border p-3 flex items-center gap-2 text-sm">
                <Bot className="w-5 h-5 text-primary" />
                <span className="font-medium">{connectedPage.page_name}</span>
                <span className="text-muted-foreground text-xs">({connectedPage.page_id})</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Bot tone</Label>
                <select className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" value={tone} onChange={(e) => setTone(e.target.value)}>
                  {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Language mode</Label>
                <select className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs">System prompt (100–2000 chars — leave empty to auto-write)</Label>
              <textarea
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-24"
                value={prompt} onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the brand voice or leave blank — the scan writes the prompt."
              />
            </div>
            <div>
              <Label className="text-xs">Manual handover after (number of bot replies)</Label>
              <Input type="number" min={0} value={handoverAfter}
                onChange={(e) => setHandoverAfter(Number(e.target.value))} />
            </div>
            <div className="flex justify-end">
              <Button size="sm" disabled={saving || !connectedPage?.id} onClick={saveConfig}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                {saving ? "Saving…" : "Save bot settings → scan"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <ScanSearch className="w-5 h-5 text-primary" /> Train the bot
              </h3>
              <p className="text-sm text-muted-foreground">
                Scans the page info, recent posts and linked website — a seeded knowledge base, adopted tone and moderator prompt are written automatically.
              </p>
              <Button size="sm" disabled={scanning} onClick={runScan}>
                {scanning ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ScanSearch className="w-4 h-4 mr-1" />}
                {scanning ? "Scanning…" : "Run business scan"}
              </Button>
              {scanResult && (
                <div className="rounded-lg border p-3 text-sm space-y-1">
                  <p className="font-medium">Scan OK</p>
                  {scanResult.summary && (
                    <p className="text-muted-foreground whitespace-pre-wrap">{JSON.stringify(scanResult.summary, null, 2)}</p>
                  )}
                  {!scanResult.summary && <p className="text-muted-foreground">Bot trained. Check the client dashboard for the knowledge base.</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-primary" /> Delivery — reset password &amp; hand over
              </h3>
              <p className="text-sm text-muted-foreground">
                Generate a fresh client password, then send this email + password to your client. They sign in at the client panel and the bot is already live on their page.
              </p>
              {generatedPw ? (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-mono text-sm">{userEmail}</p>
                  <p className="text-xs text-muted-foreground">Password</p>
                  <p className="font-mono text-sm">{generatedPw}</p>
                  <Button size="sm" variant="outline" onClick={copyCreds}>
                    <Copy className="w-4 h-4 mr-1" /> {copied ? "Copied!" : "Copy email + password"}
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" disabled={resetting} onClick={resetPw}>
                  {resetting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <KeyRound className="w-4 h-4 mr-1" />}
                  {resetting ? "Generating…" : "Generate new client password"}
                </Button>
              )}
              <div className="flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => { setStep(0); setConnectedPage(null); setScanResult(null); setGeneratedPw(null); setUserId(""); setUserEmail(""); setToken(""); setPageList([]); setFbState(""); setPrompt("") }}>
                  Configure another bot
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}