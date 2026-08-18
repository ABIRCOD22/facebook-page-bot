"use client"

/**
 * feature-tabs.tsx — tabbed product tour. Each tab swaps a big product
 * mockup (feature-media) + short bullets. Client component for state.
 */
import * as React from "react"
import { Zap, MessageCircle, UserCheck, Sparkles, Languages, ShieldCheck, BarChart3, Globe2 } from "lucide-react"
import { Reveal } from "@/components/reveal"
import { ChatMock, InboxMock, TrainMock, AnalyticsMock } from "@/components/product-mockups"

interface Tab {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  media: React.ReactNode
  points: string[]
}

const TABS: Tab[] = [
  {
    id: "auto-reply",
    label: "Auto-reply",
    icon: Zap,
    media: <ChatMock />,
    points: ["Replies in Messenger & comments 24/7", "Understands intent, not just keywords", "Links products & checkout"],
  },
  {
    id: "inbox",
    label: "Inbox & handover",
    icon: UserCheck,
    media: <InboxMock />,
    points: ["One shared conversation thread", "One-click human take-over", "Agent replies as your page"],
  },
  {
    id: "training",
    label: "Training",
    icon: Sparkles,
    media: <TrainMock />,
    points: ["Upload catalogue & FAQs", "Learns your tone of voice", "No invented facts or prices"],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    media: <AnalyticsMock />,
    points: ["Reply times & top questions", "Conversion from chat", "Catch chats needing a human"],
  },
]

export function FeatureTabs({ reverse = false }: { reverse?: boolean }) {
  const [active, setActive] = React.useState(TABS[0].id)
  const tab = TABS.find((t) => t.id === active) ?? TABS[0]

  return (
    <div>
      <div className="center" style={{ marginBottom: "1.5rem" }}>
        <div className="tabs-nav" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === active}
              className={`tab-btn ${t.id === active ? "active" : ""}`}
              onClick={() => setActive(t.id)}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`feature-row ${reverse ? "reverse" : ""}`}>
        <Reveal key={`media-${tab.id}`} className="feature-media">
          {tab.media}
        </Reveal>
        <Reveal key={`text-${tab.id}`} delay={1}>
          <span className="eyebrow eyebrow-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {tab.label}
          </span>
          <h2 className="h3 mt-3">{tab.label === "Auto-reply" ? "Your AI moderator answers instantly" : `${tab.label} that scales with you`}</h2>
          <ul className="checklist mt-4">
            {tab.points.map((p) => (
              <li key={p}>
                <Zap className="ico h-4 w-4" />
                {p}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </div>
  )
}
