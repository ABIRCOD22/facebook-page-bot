"use client"

/**
 * setup/page.tsx — step 3 of the onboarding funnel: a visual, step-by-step
 * bot setup wizard. One screen per step, an on-brand product mockup on the
 * left and a task checklist on the right. Next unlocks once every action of
 * the step is ticked. The final step verifies against the backend whether
 * the bot is connected and shows an exact error if it is not.
 *
 * Styling is 100% the marketing site design system (globals.css): .mock
 * window chrome, .tokenfield, .chatui/.bub, .checklist, .notice, .btn.
 */
import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  AppWindow,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Link2,
  Loader2,
  MessageCircle,
  MessagesSquare,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { Reveal } from "@/components/reveal"
import { SITE } from "@/lib/site"
import { loadCreds, checkBotConnection, connectFunnelPage, fetchAvailablePages, clientPanelLoginUrl, type BotStatus, type AvailableResult, type ConnectResult, type ScanSummary } from "@/lib/api"

/* ------------------------------------------------------------------ */
/* Step content                                                         */
/* ------------------------------------------------------------------ */

const CALLBACK_URL = "https://Facebook-page-bot-rdkt.onrender.com/api/webhook"

interface Action {
  text: string
  href?: string
  external?: boolean
}

interface StepDef {
  icon: typeof KeyRound
  title: string
  intro: string
  actions: Action[]
  tip: string
}

const STEPS: StepDef[] = [
  {
    icon: AppWindow,
    title: "Create your Meta app",
    intro:
      "This app is the technical bridge between your Facebook page and our system. You only do this once — about 5 minutes.",
    actions: [
      {
        text: "Open Meta for Developers and click “Create app”.",
        href: "https://developers.Facebook.com/apps",
        external: true,
      },
      { text: "Choose app type “Business”, give it a name (e.g. “My Bot App”) and click “Create”. Development mode is fine." },
      { text: "Open “Settings → Basic” and copy the App ID and App Secret — then paste them into the App credentials form on the left." },
    ],
    tip: "A Meta app needs a Facebook account. Log in as the account that manages your page.",
  },
  {
    icon: KeyRound,
    title: "Get your Access Token",
    intro:
      "This token lets your bot read and answer messages as your page. Use a User Access Token and we’ll list all your pages for you to pick — a Page Access Token also works and connects just that one page. Keep the tab open.",
    actions: [
      {
        text: "Open the Graph API Explorer (logged in as your page’s admin).",
        href: "https://developers.Facebook.com/tools/explorer/",
        external: true,
      },
      { text: "In the top-right dropdown, switch to the app you just created." },
      { text: "Add the required permissions and click “Get Access Token”. In the next step we’ll list your pages — you can pick the one the bot should serve." },
    ],
    tip: "For the full list of your pages choose a User Access Token with the pages_show_list, pages_messaging and pages_manage_metadata permissions. Token expires after a couple of hours — generate a fresh one and reconnect if the bot ever stops.",
  },
  {
    icon: Link2,
    title: "Pick your page & connect",
    intro:
      "We look up the pages your token can access and you choose which one your bot should serve — we connect it to your account and scan it so the bot knows your business.",
    actions: [
      { text: "Click “Find my pages”, choose the page, then click “Connect”. We do the rest — including teaching the bot your business." },
    ],
    tip: "Pasted a User Access Token? You’ll see every page you manage. Pasted a Page Access Token? That one page is shown — connect it directly.",
  },
  {
    icon: Settings2,
    title: "Switch on incoming messages",
    intro: "One webhook setting tells Facebook to forward every new message to your bot. About 3 minutes.",
    actions: [
      { text: "Copy the green verify token that appeared right after your page connected." },
      {
        text: "In your app: Messenger → Webhooks, click “Edit”.",
        href: "https://developers.Facebook.com/apps",
        external: true,
      },
      { text: "Paste the callback URL and the verify token, then click “Save”. You should see “Webhooks are active for: Page”." },
    ],
    tip: "Callback URL must be exactly: " + CALLBACK_URL,
  },
  {
    icon: MessageCircle,
    title: "Test your bot",
    intro: "See it live. Your bot answers on your page’s behalf in a few seconds.",
    actions: [
      { text: "Open Messenger on a second Facebook account and send your page a message (e.g. “hi, what are your prices?”)." },
      { text: "Your page replies automatically — as your page, in a few seconds." },
    ],
    tip: "Development-mode apps only deliver to testers: add your second account under “App roles → Testers” first.",
  },
]

/* ------------------------------------------------------------------ */
/* Small on-brand preview pieces (all classes from globals.css)         */
/* ------------------------------------------------------------------ */

function MockWindow({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="mock">
      <div className="mock-bar">
        <span className="mock-dot r" />
        <span className="mock-dot y" />
        <span className="mock-dot g" />
        <span className="mock-title">{title}</span>
        {badge ? <span className="mock-pill p" style={{ marginLeft: "auto" }}>{badge}</span> : null}
      </div>
      <div className="mock-body">{children}</div>
    </div>
  )
}

function MockRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span className="field-label" style={{ fontSize: "0.8rem" }}>{label}</span>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type Phase = "ask" | "creating" | "wizard"

const CREATE_STEPS = [
  "Open Facebook.com/pages/create while logged in as the account that will manage the page.",
  "Choose a category that matches your business (e.g. Restaurant, Clinic, Online Store).",
  "Add your business name, photo and cover — your bot answers using this identity.",
  "Publish the page. No posts needed yet — the bot fills the conversation.",
]

export default function SetupPage() {
  const router = useRouter()
  const [phase, setPhase] = React.useState<Phase>("ask")
  const [stepIndex, setStepIndex] = React.useState(0)
  const [ticked, setTicked] = React.useState<Record<number, boolean[]>>({})
  const [checking, setChecking] = React.useState(false)
  const [status, setStatus] = React.useState<BotStatus | null>(null)
  const creds = loadCreds()

  const [token, setToken] = React.useState("")
  const [appId, setAppId] = React.useState("")
  const [appSecret, setAppSecret] = React.useState("")
  const [connecting, setConnecting] = React.useState(false)
  const [connectMsg, setConnectMsg] = React.useState<string | null>(null)
  const [connectErr, setConnectErr] = React.useState<string | null>(null)
  const [pageName, setPageName] = React.useState<string | null>(null)
  const [verifyToken, setVerifyToken] = React.useState<string | null>(null)
  const [scanInfo, setScanInfo] = React.useState<ScanSummary | null>(null)

  const [detecting, setDetecting] = React.useState(false)
  const [available, setAvailable] = React.useState<AvailableResult | null>(null)
  const [detectErr, setDetectErr] = React.useState<string | null>(null)
  const [selectedPageId, setSelectedPageId] = React.useState<string>("")

  React.useEffect(() => {
    if (!creds) router.replace("/register")
  }, [creds, router])

  if (!creds) return null

  const step = STEPS[stepIndex]
  const allTicked = (ticked[stepIndex] ?? []).filter(Boolean).length >= step.actions.length
  const done =
    stepIndex === 0
      ? appId.trim() !== "" && appSecret.trim() !== "" && allTicked
      : stepIndex === 1
        ? token.trim() !== "" && allTicked
        : stepIndex === 2
          ? !!pageName
          : allTicked

  function toggle(i: number) {
    setTicked((prev) => {
      const next = [...(prev[stepIndex] ?? [])]
      next[i] = !next[i]
      return { ...prev, [stepIndex]: next }
    })
  }

  async function verify() {
    const c = loadCreds()
    if (!c) return
    setChecking(true)
    setStatus(null)
    setStatus(await checkBotConnection(c))
    setChecking(false)
  }

  /** Detect the pages this token can access (User token → all pages, page token → one). */
  async function detectPages() {
    const c = loadCreds()
    if (!c || !token.trim()) return
    setDetecting(true)
    setDetectErr(null)
    setAvailable(null)
    setSelectedPageId("")
    const res = await fetchAvailablePages(c, token.trim())
    setDetecting(false)
    if (res.ok && res.pages && res.pages.length > 0) {
      setAvailable(res)
      setSelectedPageId(res.pages[0].page_id)
    } else {
      setDetectErr(res.message || "No pages found for this token. Did you grant the page permissions?")
    }
  }

  /** Connect the picked page with the credentials already collected in steps 1–2. */
  async function connectPage() {
    const c = loadCreds()
    if (!c || !token.trim() || !appId.trim() || !appSecret.trim()) return
    const pageId = available?.token_type === "user" ? selectedPageId || undefined : undefined
    setConnecting(true)
    setConnectMsg(null)
    setConnectErr(null)
    const res = await connectFunnelPage(c, token.trim(), appId.trim(), appSecret.trim(), pageId)
    setConnecting(false)
    if (res.ok) {
      setPageName(res.page_name ?? null)
      setVerifyToken(res.verify_token ?? null)
      setScanInfo(res.scan ?? null)
      setConnectMsg(`Page “${res.page_name}” is connected to your account — you'll find it ready in your dashboard.`)
    } else {
      setConnectErr(res.message)
    }
  }

  /* ------------------------------ visuals ------------------------------ */

  /** Step 1 — collect the Meta app credentials live, right where they are asked for. */
  function renderAppCredsCard() {
    return (
      <div className="card-feature">
        <div className="row-sm" style={{ marginBottom: "0.9rem" }}>
          <span className="brand-mark"><KeyRound className="h-5 w-5" /></span>
          <h3 className="h3" style={{ margin: 0, fontSize: "1.05rem" }}>Your App credentials</h3>
        </div>
        <p className="lead" style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>
          We need these to receive messages for your page. Found them in Meta → Settings → Basic.
        </p>
        <div className="stack-xs">
          <div className="field">
            <span className="field-label">App ID *</span>
            <input className="field-input" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="1234567890" />
          </div>
          <div className="field">
            <span className="field-label">App Secret *</span>
            <input
              className="field-input"
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder="••••••••••••••••"
            />
          </div>
        </div>
      </div>
    )
  }

  /** Step 2 — collect the access token live. */
  function renderTokenCard() {
    return (
      <div className="card-feature">
        <div className="row-sm" style={{ marginBottom: "0.9rem" }}>
          <span className="brand-mark"><KeyRound className="h-5 w-5" /></span>
          <h3 className="h3" style={{ margin: 0, fontSize: "1.05rem" }}>Your Access Token</h3>
        </div>
        <p className="lead" style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>
          Paste a <b>User Access Token</b> to pick from all your pages, or a <b>Page Access Token</b> (starts with EAAB…) to connect a single page.
        </p>
        <div className="field">
          <span className="field-label">Access Token *</span>
          <input
            className="field-input"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="EAABxxxxx… or user token"
            style={{ fontFamily: "monospace", fontSize: "0.85rem" }}
          />
        </div>
      </div>
    )
  }

  function renderVisual() {
    switch (stepIndex) {
      case 0:
        return (
          <MockWindow title="Meta Developer · My Apps" badge="Step 1">
            <div className="between" style={{ marginBottom: "0.7rem" }}>
              <span className="field-label">My Apps</span>
              <span className="btn btn-primary btn-sm"><Sparkles className="h-4 w-4" /> Create app</span>
            </div>
            <div className="dropzone" style={{ opacity: 0.85 }}>
              <AppWindow className="h-5 w-5" />
              <span className="field-hint">Your new app appears here</span>
            </div>
            <p className="field-hint" style={{ marginTop: "0.7rem" }}>
              App type <b>Business</b> → name it → <b>Create</b>.
            </p>
          </MockWindow>
        )
      case 1:
        return (
          <MockWindow title="Graph API Explorer" badge="Step 2">
            <div className="between" style={{ marginBottom: "0.7rem" }}>
              <span className="field-label">Your app · Permissions</span>
              <span className="btn btn-primary btn-sm"><KeyRound className="h-4 w-4" /> Get Access Token</span>
            </div>
            <div className="tokenfield">EAABxxxxx…CopyMe-SGV sbG8tQ2hhdHJpWC1ib3QtNzI0NTY=</div>
            <p className="field-hint" style={{ marginTop: "0.7rem" }}>
              Add <b>pages_show_list</b>, <b>pages_messaging</b>, <b>pages_manage_metadata</b> then copy the whole token.
            </p>
          </MockWindow>
        )
      case 2:
        return (
          <MockWindow title="ChatriX · Pick your page" badge="Step 3">
            <p className="field-label" style={{ marginBottom: "0.5rem" }}>Which page should the bot serve?</p>
            <div className="stack-xs" style={{ marginBottom: "0.7rem" }}>
              {available?.pages && available.pages.length > 0 ? (
                available.pages.map((p) => (
                  <div className="between" key={p.page_id} style={{ background: "var(--surface-2)", borderRadius: "0.6rem", padding: "0.45rem 0.6rem" }}>
                    <span className="text-sm">{p.page_name}</span>
                    <span className="field-hint">{p.page_id}</span>
                  </div>
                ))
              ) : (
                <>
                  <MockRow label="Access Token">
                    <span className="tokenfield">{token ? token.slice(0, 18) + "…" : "—"}</span>
                  </MockRow>
                  <MockRow label="App ID"><span className="field-input" style={{ height: "2.2rem", display: "flex", alignItems: "center", fontSize: "0.85rem" }}>{appId || "—"}</span></MockRow>
                  <MockRow label="App Secret"><span className="field-input" style={{ height: "2.2rem", display: "flex", alignItems: "center", fontSize: "0.85rem" }}>{appSecret ? "••••••••••••" : "—"}</span></MockRow>
                </>
              )}
            </div>
            {pageName ? (
              <div className="notice notice-success" style={{ marginTop: "0.3rem" }}>
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Connected — page saved and scanned.</span>
              </div>
            ) : (
              <span className="btn btn-primary btn-sm"><Link2 className="h-4 w-4" /> Find my pages</span>
            )}
            {verifyToken ? (
              <p className="field-hint" style={{ marginTop: "0.6rem", color: "var(--success)", fontWeight: 700 }}>
                ✓ verify token generated — copy it in step 4
              </p>
            ) : null}
          </MockWindow>
        )
      case 3:
        return (
          <MockWindow title="Your Meta App · Messenger → Webhooks" badge="Step 4">
            <div className="stack-xs" style={{ marginBottom: "0.7rem" }}>
              <MockRow label="Callback URL"><span className="tokenfield">{CALLBACK_URL}</span></MockRow>
              <MockRow label="Verify token">
                <span className="tokenfield" style={{ color: "var(--success)", fontWeight: 700 }}>
                  {verifyToken || "connect-first-in-step-3"}
                </span>
              </MockRow>
            </div>
            <span className="btn btn-primary btn-sm"><ShieldCheck className="h-4 w-4" /> Save & Verify</span>
            <p className="field-hint" style={{ marginTop: "0.7rem", color: "var(--success)" }}>
              ✓ “Webhooks are active for: Page”
            </p>
          </MockWindow>
        )
      case 4:
        return (
          <MockWindow title="Messenger · your page" badge="Step 5">
            <div className="chatui">
              <div className="crow in">
                <div className="bub in">Hi! How much does your plan cost? 🙂</div>
              </div>
              <div className="crow out">
                <div className="bub out">Hey! Starter is $29/month — want me to walk you through it? 🤖</div>
              </div>
            </div>
            <p className="field-hint" style={{ marginTop: "0.7rem", color: "var(--success)" }}>
              ✓ Bot replied on your page within seconds
            </p>
          </MockWindow>
        )
      default:
        return (
          <MockWindow title="ChatriX · Bot status check" badge="Final step">
            <div className="chatui">
              <div className="crow in">
                <div className="bub in">Is my bot alive? 🤖</div>
              </div>
              <div className="crow out">
                <div className="bub out">Checking webhook + replies with our server…</div>
              </div>
            </div>
            <div className="stack-xs" style={{ marginTop: "0.8rem" }}>
              <div className="notice notice-success" style={{ padding: "0.45rem 0.7rem" }}>
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="text-sm">Page connected to your account</span>
              </div>
              {status?.connected ? (
                status.webhook_verified ? (
                  <div className="notice notice-success" style={{ padding: "0.45rem 0.7rem" }}>
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="text-sm">Webhook verified by Meta</span>
                  </div>
                ) : (
                  <div className="notice" style={{ padding: "0.45rem 0.7rem" }}>
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="text-sm">Webhook not verified yet — do step 4</span>
                  </div>
                )
              ) : null}
              {status?.connected ? (
                status.last_bot_reply_at ? (
                  <div className="notice notice-success" style={{ padding: "0.45rem 0.7rem" }}>
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="text-sm">Bot replied to a real message</span>
                  </div>
                ) : (
                  <div className="notice" style={{ padding: "0.45rem 0.7rem" }}>
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="text-sm">Waiting for the first message</span>
                  </div>
                )
              ) : null}
            </div>
          </MockWindow>
        )
    }
  }

  /* ------------------------------ guidance ----------------------------- */

  /** Shared "the bot auto-scanned your page" summary (wizard + FB flow). */
  function scanNotice(info: ScanSummary | null) {
    if (!info) return null
    return (
      <div className="notice" style={{ fontSize: "0.85rem" }}>
        <Sparkles className="h-4 w-4 shrink-0" />
        <span>
          {info.auto_voice
            ? <b>Bot learned your business — it now speaks as your page's moderator. </b>
            : <b>Bot refreshed its knowledge of your page. </b>}
          {info.posts_scanned ?? 0} post{(info.posts_scanned ?? 0) === 1 ? "" : "s"} analyzed
          {typeof info.kb_added === "number" && info.kb_added > 0 ? ` · ${info.kb_added} fact${info.kb_added === 1 ? "" : "s"} saved to its knowledge base` : ""}.
        </span>
      </div>
    )
  }

  /** Step 3 — find the user's pages, let them pick, then connect + auto-scan. */
  function renderConnectForm() {
    const pages = available?.pages ?? []
    const needsPick = available?.token_type === "user"
    const canConnect = !connecting && !pageName && token.trim() !== "" && appId.trim() !== "" && appSecret.trim() !== ""
      && (needsPick ? selectedPageId !== "" : pages.length === 1)

    return (
      <div className="stack-md">
        {!available ? (
          <>
            <p className="field-hint" style={{ fontSize: "0.9rem" }}>
              We peek at your token and list the Facebook pages it can access — you pick which one your bot serves.
            </p>
            <button className="btn btn-primary btn-lg" disabled={detecting || !token.trim()} onClick={detectPages} style={{ alignSelf: "flex-start" }}>
              {detecting ? (
                <Loader2 className="h-4 w-4 shrink-0" style={{ animation: "spin 0.7s linear infinite" }} />
              ) : (
                <MessagesSquare className="h-4 w-4 shrink-0" />
              )}
              {detecting ? "Looking up your pages…" : "Find my pages"}
            </button>
          </>
        ) : (
          <>
            <div className="field" style={{ marginBottom: "0.6rem" }}>
              <span className="field-label">
                {needsPick
                  ? `We found ${pages.length} page${pages.length > 1 ? "s" : ""} on your account — which one should the bot serve?`
                  : "This token covers one page:"}
              </span>
              <div className="stack-xs">
                {pages.map((p) => (
                  <label
                    key={p.page_id}
                    className={pageName ? undefined : "card-feature"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      padding: pageName ? "0" : "0.6rem 0.75rem",
                      cursor: pageName ? "default" : "pointer",
                    }}
                  >
                    {!pageName ? (
                      <input
                        type="radio"
                        name="page-pick"
                        checked={selectedPageId === p.page_id}
                        onChange={() => setSelectedPageId(p.page_id)}
                        style={{ width: "1.1rem", height: "1.1rem", accentColor: "var(--primary)", flexShrink: 0 }}
                      />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--success)" }} />
                    )}
                    <span className="text-sm" style={{ flex: 1 }}>
                      <b>{p.page_name}</b>
                      {p.tasks && p.tasks.length > 0 ? <span className="field-hint"> · {p.tasks.join(", ")}</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              className="btn btn-primary btn-lg"
              disabled={!canConnect}
              onClick={connectPage}
              style={{ alignSelf: "flex-start" }}
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 shrink-0" style={{ animation: "spin 0.7s linear infinite" }} />
              ) : (
                <Link2 className="h-4 w-4 shrink-0" />
              )}
              {connecting ? "Connecting…" : pageName ? "Connected ✓" : "Connect this page"}
            </button>

            <button className="btn btn-ghost btn-sm" disabled={connecting} onClick={() => { setAvailable(null); setSelectedPageId(""); setDetectErr(null) }} style={{ alignSelf: "flex-start", marginTop: "-0.4rem" }}>
              <RefreshCw className="h-4 w-4" /> Find pages again
            </button>
          </>
        )}

        {detectErr ? (
          <div className="notice notice-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{detectErr}</span>
          </div>
        ) : null}

        {connectMsg ? (
          <div className="notice notice-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{connectMsg}</span>
          </div>
        ) : null}
        {connectErr ? (
          <div className="notice notice-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{connectErr}</span>
          </div>
        ) : null}

        {scanInfo ? scanNotice(scanInfo) : null}

        {verifyToken ? (
          <div className="notice" style={{ fontSize: "0.85rem" }}>
            <KeyRound className="h-4 w-4 shrink-0" />
            <span>
              <b>Webhook verify token generated</b> — copy it now, you'll paste it in step 4.
              <button
                className="btn btn-outline btn-sm"
                onClick={() => navigator.clipboard.writeText(verifyToken)}
                style={{ marginTop: "0.4rem" }}
              >
                Copy verify token
              </button>
            </span>
          </div>
        ) : null}
      </div>
    )
  }

  function renderActions() {
    return (
      <ul className="checklist" style={{ listStyle: "none" }}>
        {step.actions.map((a, i) => {
          const checked = (ticked[stepIndex] ?? [])[i] === true
          return (
            <li key={i}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(i)}
                aria-label={"Mark done: " + a.text}
                style={{ marginTop: "0.3rem", width: "1.05rem", height: "1.05rem", accentColor: "var(--primary)", flexShrink: 0 }}
              />
              <span>
                {a.text}
                {a.href ? (
                  <>
                    {" "}
                    <a href={a.href} target="_blank" rel="noopener noreferrer" className="ulink" style={{ whiteSpace: "nowrap" }}>
                      Open {a.external ? "in new tab" : ""} <ExternalLink className="h-3.5 w-3.5" style={{ display: "inline", verticalAlign: "-0.25em" }} />
                    </a>
                  </>
                ) : null}
              </span>
            </li>
          )
        })}
      </ul>
    )
  }

  function renderVerification() {
    return (
      <div className="stack-md">
        <p className="lead" style={{ fontSize: "0.95rem" }}>
          Done everything? We log into your account with your funnel credentials and ask the server whether your bot is
          actually alive on the page — webhook verified by Meta, and the bot has replied.
        </p>

        {!status && !checking ? (
          <button className="btn btn-primary btn-lg" onClick={verify} style={{ alignSelf: "flex-start" }}>
            <RefreshCw className="h-4 w-4" /> Check if my bot is alive
          </button>
        ) : null}

        {checking ? (
          <div className="notice" style={{ alignItems: "center" }}>
            <Loader2 className="h-4 w-4 shrink-0" style={{ animation: "spin 0.7s linear infinite" }} />
            <span>Checking your account on the server…</span>
          </div>
        ) : null}

        {status ? (
          status.connected ? (
            <div className="notice notice-success" style={{ flexDirection: "column", gap: "0.6rem" }}>
              <span className="row-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <b>Your bot is connected and live!</b>
              </span>
              <span className="text-sm">
                Page: <b>{status.page_name}</b> · Bot: <b>{status.bot_name}</b>
              </span>
              <ul className="checklist" style={{ listStyle: "none", marginTop: "0.2rem" }}>
                <li>
                  <CheckCircle2 className="ico" />
                  <span>Page connected to your account</span>
                </li>
                <li>
                  {status.webhook_verified ? <CheckCircle2 className="ico" /> : <AlertCircle className="ico" style={{ color: "var(--warning, #D97706)" }} />}
                  <span>{status.webhook_verified ? "Webhook verified by Meta — messages reach your bot" : "Webhook not verified yet — complete step 4 (paste callback URL + verify token in Meta)"}</span>
                </li>
                <li>
                  {status.last_bot_reply_at ? <CheckCircle2 className="ico" /> : <AlertCircle className="ico" style={{ color: "var(--warning, #D97706)" }} />}
                  <span>{status.last_bot_reply_at ? "The bot already replied to a real message" : "No customer message yet — send one from a second account to see the bot answer"}</span>
                </li>
              </ul>
              <span>
                <a className="btn btn-primary btn-sm" href={clientPanelLoginUrl(loadCreds() ?? undefined)} target="_blank" rel="noopener noreferrer">
                  Open my dashboard <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </span>
            </div>
          ) : (
            <div className="notice notice-error" style={{ flexDirection: "column", gap: "0.6rem" }}>
              <span className="row-sm">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <b>Your bot is not connected yet</b>
              </span>
              <span className="text-sm">{status.message}</span>
              <span className="row-sm">
                <button className="btn btn-outline btn-sm" onClick={() => setStepIndex(2)}>
                  <ArrowLeft className="h-4 w-4" /> Back to step 3
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => (window.location.href = clientPanelLoginUrl(loadCreds() ?? undefined))}>
                  Open my dashboard & connect <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          )
        ) : null}
      </div>
    )
  }

  /* ------------------------------ wizard shell ------------------------- */

  function renderStepper() {
    return (
      <nav aria-label="Setup progress" className="between" style={{ gap: "0.5rem", justifyContent: "center" }}>
        {STEPS.map((s, i) => {
          const isDone = i < stepIndex
          const isCurrent = i === stepIndex
          const isLast = i === STEPS.length - 1
          const circleStyle: React.CSSProperties = {
            width: "2rem",
            height: "2rem",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            fontSize: "0.8rem",
            fontWeight: 700,
            flexShrink: 0,
            ...(isDone
              ? { background: "var(--success-soft)", color: "var(--success)" }
              : isCurrent
                ? { background: "linear-gradient(135deg, var(--primary), #9333EA)", color: "#fff", boxShadow: "var(--shadow-primary)" }
                : { background: "var(--muted)", color: "var(--muted-foreground)" }),
          }
          return (
            <React.Fragment key={s.title}>
              <span className="between" style={{ gap: "0.5rem" }}>
                <span style={circleStyle}>{isDone || (isCurrent && stepIndex === STEPS.length - 1 && status?.connected) ? <CheckCircle2 className="h-4 w-4" /> : i + 1}</span>
                <span
                  className="field-hint"
                  style={{
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? "var(--ink)" : undefined,
                    whiteSpace: "nowrap",
                    display: "none",
                  }}
                />
              </span>
              {!isLast ? <span style={{ flex: 1, height: 2, borderRadius: 2, background: isDone || (isCurrent && stepIndex === STEPS.length - 1) ? "var(--success)" : "var(--line)", minWidth: "1.25rem" }} /> : null}
            </React.Fragment>
          )
        })}
      </nav>
    )
  }

  function renderWizard() {
    return (
      <div className="stack-lg">
        {renderStepper()}

        <div className="grid md:grid-cols-2" style={{ gap: "1.75rem", alignItems: "start" }}>
          <div className="reveal in-view">
            {stepIndex === 0 ? renderAppCredsCard() : stepIndex === 1 ? renderTokenCard() : renderVisual()}
          </div>

          <div className="card-feature">
            <div className="row-sm" style={{ marginBottom: "0.5rem" }}>
              <span
                style={{
                  width: "2.6rem",
                  height: "2.6rem",
                  borderRadius: "0.85rem",
                  display: "grid",
                  placeItems: "center",
                  color: "#fff",
                  background: "linear-gradient(135deg, var(--primary), var(--accent))",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <step.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="eyebrow">Step {stepIndex + 1} of {STEPS.length}</p>
                <h2 className="h3" style={{ margin: 0 }}>{step.title}</h2>
              </div>
            </div>

            <p className="lead" style={{ fontSize: "0.95rem", marginBottom: "1rem" }}>{step.intro}</p>

            {stepIndex === 2 ? renderConnectForm() : stepIndex < STEPS.length - 1 ? renderActions() : renderVerification()}

            {stepIndex < STEPS.length - 1 && step.tip ? (
              <div className="notice" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                <span>{step.tip}</span>
              </div>
            ) : null}

            <div className="row-sm" style={{ marginTop: "1.25rem" }}>
              {stepIndex > 0 ? (
                <button className="btn btn-outline" onClick={() => { setStepIndex((s) => s - 1); setStatus(null) }}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              ) : null}
              {stepIndex < STEPS.length - 1 ? (
                <button className="btn btn-primary" disabled={!done} onClick={() => { setStepIndex((s) => s + 1); setStatus(null) }}>
                  Next step <ArrowRight className="h-4 w-4" />
                </button>
              ) : null}
              {stepIndex < STEPS.length - 1 ? (
                <button className="btn btn-ghost btn-sm" onClick={() => { setStepIndex(STEPS.length - 1); setStatus(null) }}>
                  Skip to status check
                </button>
              ) : null}
            </div>
            {stepIndex < STEPS.length - 1 && !done ? (
              <p className="field-hint" style={{ marginTop: "0.5rem" }}>
                {stepIndex === 2
                  ? "Connect your page above to unlock “Next step” — or jump straight to the final check."
                  : "Tick every box above to unlock “Next step” — or jump straight to the final check."}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className="section bg-surface-2">
      <div className="container-x">
        <Reveal className="section-head">
          <span className="eyebrow">Step 3 of 3 · Bot setup</span>
          <h1 className="h1">Configure your bot</h1>
          <p className="lead" style={{ maxWidth: "30rem" }}>
            Five short steps, each shown with exactly what to click. Account: <b>{creds.email}</b>
          </p>
        </Reveal>

        <Reveal style={{ marginTop: "2.5rem" }}>
          {phase === "ask" ? (
            <div className="auth-card" style={{ maxWidth: "34rem" }}>
              <div className="row-sm" style={{ marginBottom: "0.9rem" }}>
                <span className="brand-mark"><MessagesSquare className="h-5 w-5" /></span>
                <h2 className="h3" style={{ margin: 0 }}>Do you already have a Facebook page?</h2>
              </div>
              <p className="lead" style={{ fontSize: "0.95rem", marginBottom: "1.1rem" }}>
                Your bot lives on a Facebook Page. If you do not have one yet, we’ll show you how — it takes a few minutes.
              </p>
              <div className="grid grid-cols-2" style={{ gap: "0.75rem" }}>
                <button className="btn btn-outline btn-lg" onClick={() => setPhase("creating")}>No, not yet</button>
                <button className="btn btn-primary btn-lg" onClick={() => setPhase("wizard")}>Yes, I have one</button>
              </div>
            </div>
          ) : null}

          {phase === "creating" ? (
            <div className="auth-card" style={{ maxWidth: "34rem" }}>
              <div className="row-sm" style={{ marginBottom: "0.9rem" }}>
                <span className="brand-mark"><CheckCircle2 className="h-5 w-5" /></span>
                <h2 className="h3" style={{ margin: 0 }}>Create your Facebook page</h2>
              </div>
              <ul className="checklist" style={{ marginBottom: "1.1rem" }}>
                {CREATE_STEPS.map((s, i) => (
                  <li key={i}><CheckCircle2 className="ico" /><span>{s}</span></li>
                ))}
              </ul>
              <div className="grid grid-cols-2" style={{ gap: "0.75rem" }}>
                <a className="btn btn-outline btn-lg" href="https://www.Facebook.com/pages/create" target="_blank" rel="noopener noreferrer">
                  Open pages/create <ExternalLink className="h-4 w-4" />
                </a>
                <button className="btn btn-primary btn-lg" onClick={() => setPhase("wizard")}>I’ve created my page</button>
              </div>
            </div>
          ) : null}

          {phase === "wizard" ? renderWizard() : null}
        </Reveal>
      </div>
    </section>
  )
}
