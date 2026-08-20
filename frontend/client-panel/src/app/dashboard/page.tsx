"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  MessageSquare,
  Users,
  Bot,
  Clock,
  Settings,
  Package,
  BookOpen,
  ArrowUpRight,
  Loader2,
  Zap,
  TrendingUp,
  Power,
  Undo2,
  Users2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth-context"
import { api } from "@/lib/api"

interface Stats {
  conversations_today: number
  messages_today: number
  bot_responses_today: number
  avg_response_time_ms: number
  active_conversations: number
  total_conversations: number
  messages_7d: Array<{ date: string; count: number }>
  bot_status: string
  connected_page: string | null
}

interface ConvPreview {
  id: string
  customer_name: string
  status: string
  taken_over_at: string | null
  message_count: number
  last_message_at: string
  preview: string
  preview_sender: string | null
}

interface PageLite {
  id: string
  page_name: string
  bot_enabled: boolean
}

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return "just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function OverviewPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [convs, setConvs] = useState<ConvPreview[]>([])
  const [pages, setPages] = useState<PageLite[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [takeAllBusy, setTakeAllBusy] = useState(false)
  const [returningId, setReturningId] = useState<string | null>(null)
  const [hint, setHint] = useState("")

  async function loadAll() {
    try {
      const [s, c, p] = await Promise.all([api.getStats(), api.listConversations(), api.listPages()])
      setStats(s)
      setConvs(c.conversations)
      setPages(p.pages)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const maxBar = Math.max(1, ...(stats?.messages_7d.map((d) => d.count) || [1]))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const isIdle = stats && !stats.connected_page
  const page = pages[0]
  const botOn = page ? page.bot_enabled : false
  const takenOver = convs.filter((c) => c.status === "handed_over" && c.taken_over_at)

  async function handleToggle() {
    if (!page || toggling) return
    setToggling(true)
    setHint("")
    try {
      const res = await api.setBotEnabled(page.id, !botOn)
      setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, bot_enabled: res.bot_enabled } : p)))
      setHint(res.bot_enabled ? "Bot service is now ON." : "Bot service is now OFF — messages are logged but not answered.")
    } catch (e) {
      setHint((e as Error).message)
    } finally {
      setToggling(false)
    }
  }

  async function handleResume(id: string) {
    setReturningId(id)
    setHint("")
    try {
      await api.resumeConversation(id)
      await loadAll()
      setHint("Conversation handed back to the bot.")
    } catch (e) {
      setHint((e as Error).message)
    } finally {
      setReturningId(null)
    }
  }

  async function handleTakeOverAll() {
    if (takeAllBusy) return
    setTakeAllBusy(true)
    setHint("")
    try {
      const res = await api.takeoverAllConversations()
      await loadAll()
      setHint(`Took over ${res.taken_over} conversation${res.taken_over === 1 ? "" : "s"} — the bot pauses on them and auto-resumes any thread you leave idle.`)
    } catch (e) {
      setHint((e as Error).message)
    } finally {
      setTakeAllBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Welcome back, {user?.full_name?.split(" ")[0] || "there"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s what&apos;s happening with your bot today.
          </p>
        </div>
        {page && (
          <Button
            variant={botOn ? "outline" : "default"}
            className="gap-2"
            onClick={handleToggle}
            disabled={toggling}
          >
            {toggling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  botOn ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"
                }`}
              />
            )}
            <Power className="w-4 h-4" />
            <span className="capitalize">Bot {botOn ? "ON" : "OFF"}</span>
          </Button>
        )}
      </div>

      {hint && <p className="text-sm text-emerald-600">{hint}</p>}

      {/* Idle banner */}
      {isIdle && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-amber-900">
                Your bot is idle
              </p>
              <p className="text-sm text-amber-700 mt-0.5">
                Connect a Facebook page to start auto-replying to customers.
              </p>
            </div>
            <Link prefetch={false} href="/dashboard/pages">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                Connect a page
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Messages Today</p>
                <p className="text-3xl font-bold mt-1">{stats?.messages_today ?? 0}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <MessageSquare className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Active Conversations</p>
                <p className="text-3xl font-bold mt-1">{stats?.active_conversations ?? 0}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-violet-100 text-sm font-medium">Bot Replies Today</p>
                <p className="text-3xl font-bold mt-1">{stats?.bot_responses_today ?? 0}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Bot className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm font-medium">Avg Response Time</p>
                <p className="text-3xl font-bold mt-1">
                  {stats?.avg_response_time_ms
                    ? stats.avg_response_time_ms < 1000
                      ? `${stats.avg_response_time_ms}ms`
                      : `${(stats.avg_response_time_ms / 1000).toFixed(1)}s`
                    : "—"}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart + Recent conversations */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 7-day chart */}
        <Card className="lg:col-span-3 border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Messages — Last 7 Days
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {stats?.messages_7d.reduce((a, b) => a + b.count, 0) || 0} total
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {stats && stats.messages_7d.length > 0 ? (
              <div className="flex items-end gap-2 h-40">
                {stats.messages_7d.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      {day.count}
                    </span>
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-primary/70 to-primary transition-all duration-500"
                      style={{
                        height: `${Math.max(4, (day.count / maxBar) * 100)}%`,
                      }}
                    />
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {day.date.split(" ")[1]}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                No data yet — messages will appear here
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent conversations */}
        <Card className="lg:col-span-2 border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Recent Conversations</CardTitle>
              <Link prefetch={false} href="/dashboard/conversations">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                  View all <ArrowUpRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {convs.slice(0, 5).length > 0 ? (
              <div className="space-y-3">
                {convs.slice(0, 5).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                      {c.customer_name?.charAt(0) || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{c.customer_name}</p>
                        <Badge variant={c.status === "active" ? "success" : "outline"}>
                          {c.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {c.preview_sender === "bot" && "🤖 "}
                        {c.preview}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No conversations yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hand over customers — moderator-taken threads */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users2 className="w-4 h-4 text-primary" />
              Hand over customers
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleTakeOverAll}
              disabled={takeAllBusy}
            >
              {takeAllBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Users className="w-3 h-3" />}
              Take over all
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {takenOver.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No customers handed over to you right now. Replying to a customer from the Conversations inbox (or “Take over all”) pauses the bot on that thread automatically.
            </p>
          ) : (
            <div className="space-y-2">
              {takenOver.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl border bg-muted/30"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{c.customer_name}</p>
                      <Badge variant="warning">Handed over</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {c.preview || "No messages"} · taken {timeAgo(c.taken_over_at)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResume(c.id)}
                    disabled={returningId === c.id}
                  >
                    {returningId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
                    Get back
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link prefetch={false} href="/dashboard/settings">
              <div className="group flex items-center gap-4 p-4 rounded-xl border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Settings className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Configure Bot</p>
                  <p className="text-xs text-muted-foreground">Tone, prompts, behavior</p>
                </div>
              </div>
            </Link>
            <Link prefetch={false} href="/dashboard/products">
              <div className="group flex items-center gap-4 p-4 rounded-xl border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                  <Package className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Manage Products</p>
                  <p className="text-xs text-muted-foreground">Add or update catalog</p>
                </div>
              </div>
            </Link>
            <Link prefetch={false} href="/dashboard/knowledge">
              <div className="group flex items-center gap-4 p-4 rounded-xl border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                  <BookOpen className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Teach the Bot</p>
                  <p className="text-xs text-muted-foreground">FAQs, policies, guides</p>
                </div>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
