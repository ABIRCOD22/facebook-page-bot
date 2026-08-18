"use client"

import { useEffect, useState } from "react"
import { DollarSign, RefreshCw } from "lucide-react"
import { adminApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function RevenuePage() {
  const [rev, setRev] = useState<any>(null)
  const [payouts, setPayouts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    const r = await adminApi.getRevenue()
    setRev(r)
    const p = await adminApi.getPayouts()
    setPayouts(p.payouts)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 20000)
    return () => clearInterval(id)
  }, [])

  const setStatus = async (id: string, status: string) => {
    setBusy(id + status)
    try {
      await adminApi.updatePayoutStatus(id, status)
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (loading && !rev) return <p className="text-muted-foreground">Loading…</p>
  const r = rev || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
          <DollarSign className="w-6 h-6 text-primary" /> Revenue
        </h1>
        <Button variant="outline" size="icon" onClick={load} title="Refresh"><RefreshCw className="w-4 h-4" /></Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-3xl font-bold">{r.total_revenue ?? 0} ৳</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">MRR</p><p className="text-3xl font-bold">{r.mrr ?? 0} ৳</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Payments</p><p className="text-3xl font-bold">{r.payment_count ?? 0}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Revenue by Method</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {Object.entries(r.by_method || {}).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-muted px-4 py-2 text-sm">
              <span className="capitalize font-medium">{k}</span>: {String(v)} ৳
            </div>
          ))}
          {Object.keys(r.by_method || {}).length === 0 && <p className="text-sm text-muted-foreground">No payments recorded.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Payouts / Payments</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">User</th>
                  <th className="text-left font-medium px-4 py-3">Method</th>
                  <th className="text-left font-medium px-4 py-3">Amount</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-right font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-[180px]">{p.user_email}</p>
                      <p className="text-xs text-muted-foreground">{p.note || "—"}</p>
                    </td>
                    <td className="px-4 py-3 capitalize">{p.method}</td>
                    <td className="px-4 py-3">{p.amount} {p.currency}</td>
                    <td className="px-4 py-3"><Badge variant={p.status === "completed" ? "success" : p.status === "failed" ? "destructive" : "warning"}>{p.status}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {p.status !== "completed" && (
                          <Button size="sm" variant="outline" disabled={busy === p.id + "completed"} onClick={() => setStatus(p.id, "completed")}>Mark paid</Button>
                        )}
                        {p.status !== "refunded" && (
                          <Button size="sm" variant="ghost" disabled={busy === p.id + "refunded"} onClick={() => setStatus(p.id, "refunded")}>Refund</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {payouts.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No payments.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
