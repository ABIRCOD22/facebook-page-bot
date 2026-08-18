"use client"

import { useEffect, useState } from "react"
import { MessagesSquare, Link2, Trash2, Loader2, CheckCircle2, ScanSearch, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

interface BusinessProfile {
  page_name: string
  category: string
  summary: string
  tone: string
  style: string
  product_terms: string[]
  website_url: string
}

interface Page {
  id: string
  page_id: string
  page_name: string
  bot_name: string
  is_active: boolean
  connected_at: string
  scan_status: string
  scanned_at: string | null
  business_profile: BusinessProfile | null
}

export default function PagesPage() {
  const [pages, setPages] = useState<Page[]>([])
  const [token, setToken] = useState("")
  const [appId, setAppId] = useState("")
  const [appSecret, setAppSecret] = useState("")
  const [byoAppId, setByoAppId] = useState("")
  const [byoAppSecret, setByoAppSecret] = useState("")
  const [byoCode, setByoCode] = useState("")
  const [byoRedirect, setByoRedirect] = useState("https://fb-autoreply-client.netlify.app/fb-connect-callback")
  const [loading, setLoading] = useState(false)
  const [scanningId, setScanningId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function load() {
    try {
      const res = await api.listPages()
      setPages(res.pages)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleConnect() {
    setError("")
    setSuccess("")
    if (!token.trim()) {
      setError("Paste your Page Access Token to connect.")
      return
    }
    setLoading(true)
    try {
      await api.connectPage(token.trim(), appId.trim() || undefined, appSecret.trim() || undefined)
      setSuccess("Page connected — your bot is now live on that page.")
      setToken("")
      setAppId("")
      setAppSecret("")
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleConnectByo() {
    setError("")
    setSuccess("")
    if (!byoAppId.trim() || !byoAppSecret.trim() || !byoCode.trim() || !byoRedirect.trim()) {
      setError("Fill in App ID, App Secret, the code from Facebook and the redirect URI.")
      return
    }
    setLoading(true)
    try {
      const res = await api.connectByoApp(byoAppId.trim(), byoAppSecret.trim(), byoCode.trim(), byoRedirect.trim())
      setSuccess(`Connected "${res.page_name}" — webhook configured on your Meta app automatically.`)
      setByoCode("")
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleScan(id: string) {
    setError("")
    setScanningId(id)
    try {
      const res = await api.scanPage(id)
      setSuccess(
        `Business scan complete: ${res.profile.page_name ?? "page"} profiled, ${res.kb_added} knowledge entries added from ${res.posts_scanned} posts.`
      )
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setScanningId(null)
    }
  }

  async function handleDisconnect(id: string) {
    setError("")
    try {
      await api.disconnectPage(id)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Page Connection</h1>
        <p className="text-muted-foreground mt-1">Connect the Facebook page your bot will answer on.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="w-12 h-12 rounded-xl bg-[#1877F2]/10 flex items-center justify-center mb-2">
              <ShieldCheck className="w-6 h-6 text-[#1877F2]" />
            </div>
            <CardTitle className="text-lg">Option A — We host the app</CardTitle>
            <CardDescription>Paste a Page Access Token (long-lived). We run the bot app for you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pat">Page Access Token *</Label>
              <Input
                id="pat"
                type="password"
                placeholder="EAAB…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aid">App ID (optional)</Label>
              <Input id="aid" placeholder="1234567890" value={appId} onChange={(e) => setAppId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sec">App Secret (optional)</Label>
              <Input
                id="sec"
                type="password"
                placeholder="Used to verify webhook signatures"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
              />
            </div>

            <Button className="w-full" onClick={handleConnect} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Connect Facebook Page
            </Button>
            <p className="text-xs text-muted-foreground">
              The token is stored per page and used only to read and reply to messages.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="w-12 h-12 rounded-xl bg-[#1877F2]/10 flex items-center justify-center mb-2">
              <MessagesSquare className="w-6 h-6 text-[#1877F2]" />
            </div>
            <CardTitle className="text-lg">Option B — Your own Meta app</CardTitle>
            <CardDescription>Connect the app you created in the Meta Developer Dashboard. We wire up the webhook for you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
              <li>Create a Meta app → add the Messenger product to it.</li>
              <li>Add the Messenger API permissions: pages_messaging, pages_manage_metadata, pages_read_engagement, business_management.</li>
              <li>In App Dashboard → Messenger → OAuth, add the redirect URI from the field below.</li>
              <li>Open the Facebook Login URL below in a browser, authorize, and paste the returned code here.</li>
            </ol>
            <div className="space-y-2">
              <Label htmlFor="byoAppId">App ID *</Label>
              <Input id="byoAppId" placeholder="1234567890" value={byoAppId} onChange={(e) => setByoAppId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="byoAppSecret">App Secret *</Label>
              <Input
                id="byoAppSecret"
                type="password"
                placeholder="From App Dashboard → Settings → Basic"
                value={byoAppSecret}
                onChange={(e) => setByoAppSecret(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="byoRedirect">Redirect URI *</Label>
              <Input id="byoRedirect" value={byoRedirect} onChange={(e) => setByoRedirect(e.target.value)} />
            </div>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Get the login code</summary>
              <p className="mt-1 break-all select-all">
                https://www.facebook.com/v26.0/dialog/oauth?client_id={byoAppId || "{APP_ID}"}&amp;redirect_uri={encodeURIComponent(byoRedirect || "{REDIRECT_URI}")}&amp;scope=pages_messaging,pages_manage_metadata,pages_read_engagement,business_management
              </p>
              <p className="mt-1">Login, then copy the unique <code>code</code> param from the URL bar.</p>
            </details>
            <div className="space-y-2">
              <Label htmlFor="byoCode">Login code *</Label>
              <Input id="byoCode" placeholder="AQD…" value={byoCode} onChange={(e) => setByoCode(e.target.value)} />
            </div>

            <Button className="w-full" onClick={handleConnectByo} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Connect My Meta App
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connected pages</CardTitle>
          <CardDescription>Each connected page runs its own configured bot. Run a scan to auto-profile the business and seed your knowledge base.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pages.length === 0 && (
            <p className="text-sm text-muted-foreground">No pages connected yet.</p>
          )}
          {pages.map((p) => (
            <div key={p.id} className="p-3 rounded-xl border">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.page_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.bot_name}</p>
                </div>
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                  {p.scan_status}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleScan(p.id)}
                  disabled={scanningId === p.id}
                >
                  {scanningId === p.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ScanSearch className="w-4 h-4" />
                  )}
                  {p.business_profile ? "Re-scan" : "Scan business"}
                </Button>
                <Button size="icon" variant="ghost" aria-label="Disconnect" onClick={() => handleDisconnect(p.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              {p.business_profile && (
                <div className="mt-3 pt-3 border-t text-sm space-y-2">
                  <p className="text-xs text-muted-foreground">{p.business_profile.summary}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-[#1877F2]/10 text-[#1877F2] capitalize">tone: {p.business_profile.tone}</span>
                    {p.business_profile.website_url && (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground break-all">{p.business_profile.website_url}</span>
                    )}
                  </div>
                  {p.business_profile.product_terms.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Offers detected: {p.business_profile.product_terms.slice(0, 3).map((t) => `"${t}…"`).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && (
            <p className="text-sm text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> {success}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}