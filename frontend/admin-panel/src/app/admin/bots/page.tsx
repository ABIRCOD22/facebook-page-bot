"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bot, PauseCircle, PlayCircle, RefreshCw } from "lucide-react"
import { adminApi } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const FILTERS = ["", "active", "paused"]

export default function BotsPage() {
  const [bots, setBots] = useState<any[]>([])
  const [filter, setFilter] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await adminApi.getBots(filter || undefined)
      setBots(r.bots)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])
  useEffect(() => { const id = setInterval(load, 15000); return () => clearInterval(id) }, [load])

  const toggle = async (id: string, active: boolean) => {
    setBusy(id)
    try {
      if (active) await adminApi.pauseBot(id)
      else await adminApi.resumeBot(id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
            <Bot className="w-6 h-6 text-primary" /> Bots
          </h1>
          <p className="text-sm text-muted-foreground">{bots.length} connected pages</p>
        </div>
        <Button variant="outline" size="icon" onClick={load} title="Refresh"><RefreshCw className="w-4 h-4" /></Button>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f === "" ? "All" : f === "active" ? "Running" : "Paused"}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bots.map((b) => (
          <Card key={b.page_id}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{b.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{b.owner_email}</p>
                </div>
                <Badge variant={b.is_active ? "success" : "destructive"}>{b.is_active ? "Running" : "Paused"}</Badge>
              </div>
              <div className="flex gap-2">
                <Link prefetch={false} href={`/admin/users/user-detail?id=${b.owner_id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">Owner</Button>
                </Link>
                <Button
                  variant={b.is_active ? "outline" : "default"}
                  size="sm"
                  className="flex-1"
                  disabled={busy === b.page_id}
                  onClick={() => toggle(b.page_id, b.is_active)}
                >
                  {b.is_active ? <><PauseCircle className="w-4 h-4" /> Pause</> : <><PlayCircle className="w-4 h-4" /> Resume</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && bots.length === 0 && <p className="text-muted-foreground col-span-full">No bots found.</p>}
      </div>
    </div>
  )
}
