"use client"

import { useEffect, useState } from "react"
import { BarChart3 } from "lucide-react"
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts"
import { adminApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.getAnalytics().then(setData).catch(() => {}).finally(() => setLoading(false))
    const id = setInterval(() => adminApi.getAnalytics().then(setData).catch(() => {}), 30000)
    return () => clearInterval(id)
  }, [])

  if (loading && !data) return <p className="text-muted-foreground">Loading…</p>
  const d = data || {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
          <BarChart3 className="w-6 h-6 text-primary" /> Analytics
        </h1>
        <p className="text-sm text-muted-foreground">Last 14 days · auto-refresh 30s</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-lg">Messages / Day</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={d.messages_trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#7C3AED" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">New Users / Day</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={d.users_trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#0891B2" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Revenue by Tier (MRR)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={d.revenue_by_tier || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="tier" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="mrr" fill="#7C3AED" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Top Users by Messages</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(d.top_users || []).map((u: any) => (
              <div key={u.user_id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                <span className="truncate">{u.email}</span>
                <span className="font-medium">{u.messages_used}</span>
              </div>
            ))}
            {(d.top_users || []).length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Total Messages</p><p className="text-3xl font-bold">{d.totals?.messages ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Total Conversations</p><p className="text-3xl font-bold">{d.totals?.conversations ?? 0}</p></CardContent></Card>
      </div>
    </div>
  )
}
