"use client"

/**
 * live-chat-demo.tsx — interactive Messenger-style demo. Visitors click a
 * quick-reply chip (or type) and get a scripted, on-brand bot answer with a
 * typing indicator. Pure client-side; demonstrates the product honestly.
 */
import * as React from "react"
import { Send, MessageCircle } from "lucide-react"
import { SITE } from "@/lib/site"

type Msg = { from: "in" | "out"; text: string }

const QUICK = ["Do you ship to Berlin?", "What's your return policy?", "Talk to a human", "Track my order"]

const REPLIES: Record<string, string> = {
  "do you ship to berlin?": "Yes! We ship to Berlin free in 2–4 days. Want the checkout link? 🚚",
  "what's your return policy?": "30-day free returns, no questions asked. Just reply “start return” and I'll guide you. ↩️",
  "talk to a human": "Sure — handing you to a teammate now. They'll see this whole chat. 👋",
  "track my order": "Your order #4821 is out for delivery today, ETA 4–6pm. 📦",
}

function answer(input: string): string {
  const q = input.trim().toLowerCase()
  for (const key of Object.keys(REPLIES)) {
    if (q.includes(key.replace("?", ""))) return REPLIES[key]
  }
  return "Great question! I'm ChatriX, your AI moderator — ask about shipping, returns, orders, or say “human” to connect an agent. 😊"
}

export function LiveChatDemo({ title = "Live demo · Messenger" }: { title?: string }) {
  const [msgs, setMsgs] = React.useState<Msg[]>([
    { from: "in", text: "Hi! Is the Aurora lamp in stock? 💡" },
    { from: "out", text: "Hey! Yes — Aurora is in stock and ships today. Want 10% off with WELCOME10? 🎉" },
  ])
  const [typing, setTyping] = React.useState(false)
  const [value, setValue] = React.useState("")
  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  const say = React.useCallback((text: string) => {
    if (!text.trim()) return
    setMsgs((m) => [...m, { from: "in", text }])
    setTyping(true)
    window.setTimeout(() => {
      setMsgs((m) => [...m, { from: "out", text: answer(text) }])
      setTyping(false)
    }, 700)
  }, [])

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [msgs, typing])

  return (
    <div className="mock" style={{ boxShadow: "var(--shadow-xl)" }}>
      <div className="mock-bar">
        <span className="mock-dot r" /><span className="mock-dot y" /><span className="mock-dot g" />
        <span className="mock-title">{title}</span>
        <span className="mock-pill p" style={{ marginLeft: "auto" }}>
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Auto-replying
        </span>
      </div>
      <div className="mock-body">
        <div className="chatui" ref={scrollRef} style={{ maxHeight: 260, overflowY: "auto" }}>
          {msgs.map((m, i) => (
            <div key={i} className={`crow ${m.from}`}>
              <div className={`bub ${m.from}`}>{m.text}</div>
            </div>
          ))}
          {typing ? (
            <div className="crow in typing"><div className="bub"><span className="tdot" /><span className="tdot" /><span className="tdot" /></div></div>
          ) : null}
        </div>

        <div className="qchips">
          {QUICK.map((q) => (
            <button key={q} className="qchip" onClick={() => say(q)}>{q}</button>
          ))}
        </div>

        <form
          className="demo-input"
          onSubmit={(e) => {
            e.preventDefault()
            say(value)
            setValue("")
          }}
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type a message…"
            aria-label="Type a message to the demo bot"
          />
          <button type="submit" className="btn btn-primary btn-sm" aria-label="Send">
            <Send className="h-4 w-4" />
          </button>
        </form>

        <div className="row-xs" style={{ marginTop: "0.6rem", fontSize: "0.72rem", color: "var(--muted-foreground)" }}>
          <MessageCircle className="h-3.5 w-3.5 text-primary" />
          Powered by {SITE.name} — try it, it really replies
        </div>
      </div>
    </div>
  )
}
