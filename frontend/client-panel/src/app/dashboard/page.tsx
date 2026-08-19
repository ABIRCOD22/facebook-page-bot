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
  message_count: number
  last_message_at: string
  preview: string
  preview_sender: string | null
}

export default function OverviewPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [convs, setConvs] = useState<ConvPreview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getStats(), api.listConversations()])
      .then(([s, c]) => {
        setStats(s)
        setConvs(c.conversations.slice(0, 5))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
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
        {stats && (
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                stats.bot_status === "online"
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-muted-foreground/40"
              }`}
            />
            <span className="text-sm font-medium text-muted-foreground capitalize">
              Bot {stats.bot_status}
            </span>
          </div>
        )}
      </div>

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
            {convs.length > 0 ? (
              <div className="space-y-3">
                {convs.map((c) => (
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
