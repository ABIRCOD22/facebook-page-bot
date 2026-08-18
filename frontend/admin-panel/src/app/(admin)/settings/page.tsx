"use client"

import { useEffect, useState } from "react"
import { Settings as SettingsIcon, Save } from "lucide-react"
import { adminApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export default function SettingsPage() {
  const [s, setS] = useState({ maintenance_mode: false, maintenance_message: "", broadcast_message: "", default_tier: "free_trial" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    adminApi.getSettings().then(setS).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await adminApi.updateSettings(s)
      alert("Settings saved.")
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
        <SettingsIcon className="w-6 h-6 text-primary" /> System Settings
      </h1>

      <Card>
        <CardHeader><CardTitle className="text-lg">Maintenance</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={s.maintenance_mode}
              onChange={(e) => setS({ ...s, maintenance_mode: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm">Maintenance mode {s.maintenance_mode && <Badge variant="warning">ON</Badge>}</span>
          </label>
          <div className="space-y-1">
            <Label>Maintenance message</Label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={s.maintenance_message}
              onChange={(e) => setS({ ...s, maintenance_message: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Broadcast</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <Label>Global broadcast message (shown to all users)</Label>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={s.broadcast_message}
            onChange={(e) => setS({ ...s, broadcast_message: e.target.value })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Defaults</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <Label>Default subscription tier for new signups</Label>
          <Input value={s.default_tier} onChange={(e) => setS({ ...s, default_tier: e.target.value })} />
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving}><Save className="w-4 h-4" /> Save settings</Button>
    </div>
  )
}
