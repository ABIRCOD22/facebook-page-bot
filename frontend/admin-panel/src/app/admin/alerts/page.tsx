"use client"

import { useEffect, useState } from "react"
import { Bell, CheckCircle2, AlertTriangle, Info, RefreshCw } from "lucide-react"
import { adminApi } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    const r = await adminApi.getAlerts()
    setAlerts(r.alerts)
    setLoading(false)
  }
  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id) }, [])

  const resolve = async (id: string) => {
    setBusy(id)
    try { await adminApi.resolveAlert(id); await load() } finally { setBusy(null) }
  }

  const Icon = (sev: string) =>
    sev === "critical" ? <AlertTriangle className="w-4 h-4 text-destructive" />
      : sev === "warning" ? <AlertTriangle className="w-4 h-4 text-amber-500" />
        : <Info className="w-4 h-4 text-muted-foreground" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
            <Bell className="w-6 h-6 text-primary" /> Alerts
          </h1>
          <p className="text-sm text-muted-foreground">{alerts.filter((a) => !a.is_resolved).length} open</p>
        </div>
        <Button variant="outline" size="icon" onClick={load} title="Refresh"><RefreshCw className="w-4 h-4" /></Button>
      </div>

      <div className="space-y-3">
        {alerts.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-4 flex items-center gap-3">
              {Icon(a.severity)}
              <div className="flex-1 min-w-0">
                <p className="text-sm">{a.message}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="capitalize">{a.type.replace(/_/g, " ")}</span> · {a.created_at ? a.created_at.slice(0, 10) : ""}
                </p>
              </div>
              <Badge variant={a.is_resolved ? "success" : a.severity === "critical" ? "destructive" : a.severity === "warning" ? "warning" : "outline"}>
                {a.is_resolved ? "Resolved" : a.severity}
              </Badge>
              {!a.is_resolved && (
                <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => resolve(a.id)}>
                  <CheckCircle2 className="w-4 h-4" /> Resolve
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {!loading && alerts.length === 0 && <p className="text-muted-foreground">No alerts.</p>}
      </div>
    </div>
  )
}
