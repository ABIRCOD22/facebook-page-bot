"use client"

import Link from "next/link"
import { Users, Bot, DollarSign, Bell, AlertTriangle, CheckCircle2, Info, CreditCard } from "lucide-react"
import { adminApi } from "@/lib/api"
import { usePolling } from "@/lib/use-polling"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

function Kpi({ icon, label, value, sub, href }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; href?: string }) {
  const body = (
    <Card className="hover:shadow-md transition-shadow duration-200 cursor-pointer">
      <CardContent className="p-5 flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold mt-1" style={{ fontFamily: "var(--font-heading)" }}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

export default function OverviewPage() {
  const { data, loading } = usePolling(() => adminApi.getOverview(), 15000)
  const o = data || ({} as Record<string, any>)

  const alertVariant = (sev: string) =>
    sev === "critical" ? "destructive" : sev === "warning" ? "warning" : "default"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Master Overview</h1>
        <p className="text-sm text-muted-foreground">Platform-wide health and control at a glance.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={<Users className="w-5 h-5" />} label="Total Users" value={o.total_users ?? "—"} sub={`${o.active_users ?? 0} active · ${o.new_signups_30d ?? 0} new/30d`} href="/admin/users" />
        <Kpi icon={<Bot className="w-5 h-5" />} label="Active Bots" value={o.active_bots ?? "—"} sub={`${o.paused_bots ?? 0} paused`} href="/admin/bots" />
        <Kpi icon={<DollarSign className="w-5 h-5" />} label="Monthly Revenue" value={`${o.mrr ?? 0} ৳`} sub={`${o.active_subscriptions ?? 0} active subs`} href="/admin/revenue" />
        <Kpi icon={<Bell className="w-5 h-5" />} label="Open Alerts" value={o.open_alerts ?? "—"} sub={`${o.suspended_subscriptions ?? 0} suspended`} href="/admin/alerts" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Secondary Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Connected Pages</span><span className="font-medium">{o.total_pages ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Conversations</span><span className="font-medium">{o.total_conversations ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Products Indexed</span><span className="font-medium">{o.total_products ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Messages Used</span><span className="font-medium">{o.messages_used ?? 0}</span></div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Users</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/admin/users">View all</Link></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(o.recent_users ?? []).map((u: any) => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <Badge variant={u.is_active ? "success" : "outline"}>{u.is_active ? "Active" : "Inactive"}</Badge>
              </div>
            ))}
            {(o.recent_users ?? []).length === 0 && <p className="text-sm text-muted-foreground">No users yet.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Alerts</CardTitle>
          <Button asChild variant="ghost" size="sm"><Link href="/admin/alerts">Alert Center</Link></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(o.recent_alerts ?? []).map((a: any) => {
            const Icon = a.severity === "critical" ? AlertTriangle : a.severity === "warning" ? AlertTriangle : Info
            return (
              <div key={a.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                <Icon className={`w-4 h-4 mt-0.5 ${a.severity === "critical" ? "text-destructive" : a.severity === "warning" ? "text-amber-500" : "text-muted-foreground"}`} />
                <p className="text-sm flex-1">{a.message}</p>
                <Badge variant={alertVariant(a.severity)}>{a.severity}</Badge>
              </div>
            )
          })}
          {(o.recent_alerts ?? []).length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> All clear — no open alerts.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
