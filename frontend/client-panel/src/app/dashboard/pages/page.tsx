"use client"

import { useEffect, useState } from "react"
import { MessagesSquare, Link2, Trash2, Loader2, CheckCircle2, ScanSearch, ShieldCheck, Power } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

const PRIVACY_POLICY_URL =
  "https://docs.google.com/document/d/1k_8kG2Nn8fiTO75uPxBTX9W54hdnlQBfy-2BoO_DmNI/edit?usp=sharing"

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
  bot_enabled: boolean
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
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [hasPage, setHasPage] = useState<boolean | null>(null)

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
    if (!token.trim() || !appId.trim() || !appSecret.trim()) {
      setError("Fill in your Page Access Token, App ID and App Secret before connecting.")
      return
    }
    setLoading(true)
    try {
      await api.connectPage(token.trim(), appId.trim(), appSecret.trim())
      setSuccess("Page connected — your webhook was configured automatically and your bot is live.")
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

  async function handleToggleBot(id: string, current: boolean) {
    setError("")
    setTogglingId(id)
    try {
      await api.setBotEnabled(id, !current)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Page Connection</h1>
        <p className="text-muted-foreground mt-1">Connect the Facebook page your bot will answer on.</p>
      </div>

      {pages.length === 0 && hasPage === null && (
        <Card className="border-[#1877F2]/30 bg-[#1877F2]/5">
          <CardContent className="py-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="font-semibold text-lg" style={{ fontFamily: "var(--font-heading)" }}>Let&apos;s get your bot online</p>
              <p className="text-sm text-muted-foreground mt-1">
                First things first — do you already have a Facebook page for your business?
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" onClick={() => setHasPage(false)}>No, not yet</Button>
              <Button onClick={() => setHasPage(true)}>Yes, I have one</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {pages.length === 0 && hasPage === false && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create your Facebook page first</CardTitle>
            <CardDescription>Your bot lives on a Facebook Page — here&apos;s how to create one in a few minutes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-2">
              <li>Go to facebook.com/pages/create and log in to the Facebook account that will manage the page.</li>
              <li>Choose a category that matches your business (e.g. Restaurant, Clinic, Online Store).</li>
              <li>Add your business name, profile photo and cover photo — the bot will answer using your page&apos;s identity.</li>
              <li>Publish the page. You do not need to post anything yet.</li>
            </ol>
            <div className="flex gap-2">
              <a
                href="https://www.facebook.com/pages/create"
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "default" })}
              >
                Open facebook.com/pages/create
              </a>
              <Button variant="outline" onClick={() => setHasPage(true)}>I&apos;ve created my page</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {pages.length === 0 && hasPage === true && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Set up your bot — 6 simple steps</CardTitle>
            <CardDescription>Follow the steps in order. Everything is a few clicks — no coding needed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <div className="rounded-lg border border-[#1877F2]/30 bg-[#1877F2]/5 px-3 py-2 text-xs text-muted-foreground">
              By connecting a page to this service, you agree to our{" "}
              <a
                className="ulink font-medium text-[#1877F2]"
                href={PRIVACY_POLICY_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>{" "}
              (opens in a new tab). Meta will also ask for a privacy policy when your app goes through App Review — you
              can reuse this same link there.
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Step 1 — Create a Meta developer account (only if you&apos;re new, ~3 min)</p>
              <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                <li>
                  Open{" "}
                  <a className="ulink" href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer">
                    developers.facebook.com
                  </a>{" "}
                  in a new tab and log in with the same Facebook account that manages your page.
                </li>
                <li>
                  If you&apos;ve never logged in here before: click <b>Get Started</b>, accept the Developer Agreement,
                  and confirm your phone or email when asked.
                </li>
                <li>You do <b>not</b> need to write any code — you&apos;re only creating the app we will connect to.</li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Step 2 — Create your Meta app (~2 min)</p>
              <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                <li>
                  On developers.facebook.com click <b>Create App</b> → choose <b>Business</b> → give it a name (e.g.{" "}
                  <i>&quot;My Shop Bot&quot;</i>) → <b>Create App</b>. Development mode is fine.
                </li>
                <li>
                  Open <b>Settings → Basic</b> and keep this tab open — you&apos;ll need the <b>App ID</b> (a ~12-digit
                  number) and <b>App Secret</b> (click <b>Show</b> → copy) in Step 5.
                </li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Step 3 — Add Messenger and connect your page (~2 min)</p>
              <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                <li>In your app, click <b>Add Product</b> (left menu) → choose <b>Messenger</b> → <b>Add</b>.</li>
                <li>
                  Under <b>Messenger → Access Tokens</b>, click <b>Add or remove Pages</b> and connect the page you want
                  your bot to run on.
                </li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Step 4 — Get your Page Access Token (~1 min)</p>
              <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                <li>
                  On the same <b>Messenger → Access Tokens</b> screen, select your page, then <b>generate a token</b>{" "}
                  for it and copy it (it starts with <code className="text-xs">EAAB…</code>).
                </li>
                <li className="pt-1 text-xs">
                  Note: the token can expire. If the bot ever stops replying, just generate a fresh one here and
                  reconnect using the card below.
                </li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Step 5 — Connect your page here (~30 sec)</p>
              <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                <li>In the <b>Connect with your token</b> card below, paste the <b>Page Access Token</b>, <b>App ID</b> and <b>App Secret</b> from Steps 2 &amp; 4.</li>
                <li>Click <b>Connect Facebook Page</b>.</li>
                <li>
                  We configure your app&apos;s webhook <b>automatically</b> — you do not need to touch the Meta
                  dashboard again.
                </li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Step 6 — Test the bot (~3 min)</p>
              <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                <li>
                  Send your page a message from a <b>second Facebook account</b>. If your app is in Development mode,
                  first add that account as a <b>Tester</b> in App Dashboard → <b>App roles</b>.
                </li>
                <li>Your page should reply within a few seconds.</li>
              </ol>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Step 7 — Go live for real customers (do this before launch)</p>
              <p className="text-muted-foreground">
                In Development mode your app can only reply to people you add as Testers. To let real customers use the
                bot, submit your app for <b>Meta App Review</b> (Messenger permissions) and switch the app to <b>Live</b>.
                Meta will ask for a Privacy Policy URL — you can use ours from the note at the top of this card.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Step 8 — Feed the bot your business info (optional but recommended)</p>
              <p className="text-muted-foreground">
                In the <b>Connected pages</b> list, click <b>Scan business</b> — the bot studies your page&apos;s posts
                and learns your products, tone and prices automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="w-12 h-12 rounded-xl bg-[#1877F2]/10 flex items-center justify-center mb-2">
            <ShieldCheck className="w-6 h-6 text-[#1877F2]" />
          </div>
          <CardTitle className="text-lg">Connect with your token</CardTitle>
          <CardDescription>
            Paste the values from your Meta app (Steps 2 &amp; 4 above). We configure the webhook automatically.
          </CardDescription>
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
            <Label htmlFor="aid">App ID *</Label>
            <Input id="aid" placeholder="1234567890" value={appId} onChange={(e) => setAppId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sec">App Secret *</Label>
            <Input
              id="sec"
              type="password"
              placeholder="From App Dashboard → Settings → Basic"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
            />
          </div>

          <Button className="w-full" onClick={handleConnect} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Connect Facebook Page
          </Button>
          <p className="text-xs text-muted-foreground">
            The token is stored per page and used only to read and reply to messages. Your app secret is used solely to
            verify that messages really come from Facebook.
          </p>
        </CardContent>
      </Card>

      <details className="rounded-xl border border-border bg-card overflow-hidden">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium hover:bg-muted/60">
          <span className="flex items-center gap-2">
            <MessagesSquare className="w-4 h-4 text-[#1877F2]" />
            Advanced — connect with Facebook Login instead
          </span>
        </summary>
        <div className="border-t px-4 py-4 space-y-4">
          <CardDescription className="text-xs">
            Prefer not to paste a token? Log in with Facebook and we pick the token up for you. You&apos;ll need to add
            the redirect URI below to your app first (App Dashboard → Facebook Login → Settings).
          </CardDescription>
          <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
            <li>Create a Meta app → add the Messenger product to it.</li>
            <li>Add Messenger API permissions: pages_messaging, pages_manage_metadata, pages_read_engagement, business_management.</li>
            <li>Add the redirect URI below to App Dashboard → Facebook Login → Settings.</li>
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

          <Button className="w-full" variant="outline" onClick={handleConnectByo} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Connect My Meta App
          </Button>
        </div>
      </details>

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
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    p.bot_enabled ? "bg-emerald-500" : "bg-muted-foreground/40"
                  }`}
                />
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
                  onClick={() => handleToggleBot(p.id, p.bot_enabled)}
                  disabled={togglingId === p.id}
                  title={p.bot_enabled ? "Turn bot service off for this page" : "Turn bot service on for this page"}
                >
                  {togglingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                  {p.bot_enabled ? "ON" : "OFF"}
                </Button>
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