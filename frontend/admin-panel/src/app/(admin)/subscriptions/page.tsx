"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CreditCard, RefreshCw } from "lucide-react"
import { adminApi } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const FILTERS = ["", "active", "suspended", "cancelled"]

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState("")
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await adminApi.getSubscriptions(filter || undefined)
      setSubs(r.subscriptions)
      setTotal(r.total)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])
  useEffect(() => { const id = setInterval(load, 15000); return () => clearInterval(id) }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
            <CreditCard className="w-6 h-6 text-primary" /> Subscriptions
          </h1>
          <p className="text-sm text-muted-foreground">{total} subscriptions</p>
        </div>
        <Button variant="outline" size="icon" onClick={load} title="Refresh"><RefreshCw className="w-4 h-4" /></Button>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f === "" ? "All" : f}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">User</th>
                  <th className="text-left font-medium px-4 py-3">Tier</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-left font-medium px-4 py-3">Messages</th>
                  <th className="text-left font-medium px-4 py-3">Expires</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.user_id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${s.user_id}`} className="font-medium hover:underline">{s.user_name || "—"}</Link>
                      <p className="text-xs text-muted-foreground">{s.user_email}</p>
                    </td>
                    <td className="px-4 py-3"><Badge variant="secondary">{s.tier}</Badge></td>
                    <td className="px-4 py-3">
                      <Badge variant={s.status === "active" ? "success" : s.status === "suspended" ? "destructive" : "warning"}>{s.status}</Badge>
                    </td>
                    <td className="px-4 py-3">{s.messages_used} / {s.messages_limit ?? "∞"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.ends_at ? s.ends_at.slice(0, 10) : "—"}</td>
                  </tr>
                ))}
                {!loading && subs.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No subscriptions.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
