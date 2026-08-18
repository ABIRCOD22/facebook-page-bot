/**
 * product-mockups.tsx — pure JSX/CSS mockups of the ChatriX product so the
 * marketing site SHOWS the product, not just describes it. No images, no
 * external dependencies. All on-white, purple/cyan accents.
 */
import * as React from "react"
import { MessageCircle, Send, Languages, Sparkles, ShieldCheck, UserCheck, BarChart3, Bot, FileText, UploadCloud } from "lucide-react"

function MockChrome({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className="mock">
      <div className="mock-bar">
        <span className="mock-dot r" />
        <span className="mock-dot y" />
        <span className="mock-dot g" />
        <span className="mock-title">{title}</span>
        {accent ? <span className="mock-pill p" style={{ marginLeft: "auto" }}>Live</span> : null}
      </div>
      <div className="mock-body">{children}</div>
    </div>
  )
}

/** Messenger-style auto-reply conversation. */
export function ChatMock({ compact = false }: { compact?: boolean }) {
  return (
    <MockChrome title="ChatriX · Messenger" accent>
      <div className="chatui">
        <div className="crow in"><div className="bub in">Hi! Do you ship the Aurora lamp to Berlin? 🌍</div></div>
        <div className="crow out"><div className="bub out">Yes! Free shipping to Berlin in 2–4 days. Want the link?</div></div>
        <div className="crow in"><div className="bub in">Please 🙏</div></div>
        <div className="crow out"><div className="bub out">Here you go 👉 chatrix.shop/aurora — use WELCOME10 for 10% off.</div></div>
      </div>
    </MockChrome>
  )
}

/** Inbox with AI / human handover states. */
export function InboxMock() {
  const rows = [
    { nm: "Marco", ms: "Where is my order #4821?", tag: "Human", t: "M" },
    { nm: "Aisha", ms: "Do you have this in blue?", tag: "AI", t: "A", ai: true },
    { nm: "Liam", ms: "Refund status?", tag: "AI", t: "L", ai: true },
    { nm: "Sofia", ms: "Can I talk to a person?", tag: "Handover", t: "S" },
  ]
  return (
    <MockChrome title="ChatriX · Inbox">
      <div className="inbox">
        {rows.map((r) => (
          <div className="inrow" key={r.nm}>
            <span className="avatar">{r.t}</span>
            <div className="meta" style={{ flex: 1 }}>
              <div className="nm">{r.nm}</div>
              <div className="ms">{r.ms}</div>
            </div>
            <span className={`mock-pill ${r.ai ? "a" : "p"}`}>
              {r.tag === "Handover" ? <UserCheck className="h-3 w-3" /> : r.ai ? <Bot className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
              {r.tag}
            </span>
          </div>
        ))}
      </div>
    </MockChrome>
  )
}

/** Knowledge / training upload. */
export function TrainMock() {
  const files = ["product-catalog.pdf", "faq.txt", "shipping-policy.docx"]
  return (
    <MockChrome title="ChatriX · Knowledge">
      <div className="dropzone">
        <UploadCloud className="h-6 w-6" />
        <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Drop files or paste a link</div>
        <div style={{ fontSize: "0.74rem", opacity: 0.8 }}>PDF · TXT · DOCX · URL</div>
      </div>
      <div className="flex" style={{ flexDirection: "column", gap: "0.45rem", marginTop: "0.7rem" }}>
        {files.map((f) => (
          <div className="filecard" key={f}>
            <span className="ic"><FileText className="h-4 w-4" /></span>
            <span style={{ flex: 1 }}>{f}</span>
            <span className="mock-pill a">Trained</span>
          </div>
        ))}
      </div>
    </MockChrome>
  )
}

/** Analytics bar chart. */
export function AnalyticsMock() {
  const bars = [
    { h: 40, alt: false, label: "Mon" },
    { h: 65, alt: true, label: "Tue" },
    { h: 52, alt: false, label: "Wed" },
    { h: 88, alt: true, label: "Thu" },
    { h: 74, alt: false, label: "Fri" },
    { h: 96, alt: true, label: "Sat" },
    { h: 60, alt: false, label: "Sun" },
  ]
  return (
    <MockChrome title="ChatriX · Analytics">
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", color: "var(--ink-soft)", marginBottom: "0.4rem" }}>
        <span>Auto-replies this week</span>
        <span className="mock-pill p" style={{ fontSize: "0.7rem" }}>▲ 38%</span>
      </div>
      <div className="bars">
        {bars.map((b) => (
          <div key={b.label} className={`bar ${b.alt ? "alt" : ""}`} style={{ height: `${b.h}%` }}>
            <span>{b.label}</span>
          </div>
        ))}
      </div>
      <div className="row-sm" style={{ marginTop: "0.5rem", fontSize: "0.74rem", color: "var(--muted-foreground)" }}>
        <BarChart3 className="h-4 w-4 text-primary" /> Avg first reply: 47s · Handover: 12%
      </div>
    </MockChrome>
  )
}

/** Page Access Token paste step. */
export function TokenMock() {
  return (
    <MockChrome title="ChatriX · Connect page">
      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ink)", marginBottom: "0.4rem" }}>
        Paste your Facebook Page Access Token
      </div>
      <div className="tokenfield">EAAB…9kQZC2t7xQw3bR1pL8mF6vN0cD4eS2aY5uI9oP3wX7zK1jH8gT6sB2vC9m</div>
      <div className="row-sm" style={{ marginTop: "0.7rem" }}>
        <span className="mock-pill p"><ShieldCheck className="h-3 w-3" /> Verified</span>
        <span className="mock-pill a"><Sparkles className="h-3 w-3" /> Connected</span>
      </div>
    </MockChrome>
  )
}

/** Generic icon tile for bento cells. */
export function MockIconTile({ icon: Icon, label, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
      <span className="bento-icon" style={{ width: "2.2rem", height: "2.2rem", marginBottom: 0 }}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: "0.92rem" }}>{label}</div>
        {hint ? <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>{hint}</div> : null}
      </div>
    </div>
  )
}
