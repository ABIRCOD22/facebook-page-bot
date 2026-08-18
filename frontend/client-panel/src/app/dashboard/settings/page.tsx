"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

const TONES = ["professional_friendly", "casual", "formal", "witty"]
const LANGUAGES = ["auto", "en_only", "bn_only", "bilingual"]

type Settings = {
  bot_name: string
  bot_tone: string
  language_mode: string
  system_prompt: string
  welcome_message: string
  fallback_message: string
  handover_message: string
  auto_handover_after: number
  quick_replies_enabled: boolean
  typing_indicator_enabled: boolean
  fetch_customer_name: boolean
}

const EMPTY: Settings = {
  bot_name: "",
  bot_tone: "professional_friendly",
  language_mode: "auto",
  system_prompt: "",
  welcome_message: "",
  fallback_message: "",
  handover_message: "Let me connect you with a human agent.",
  auto_handover_after: 0,
  quick_replies_enabled: true,
  typing_indicator_enabled: true,
  fetch_customer_name: true,
}

export default function BotSettingsPage() {
  const [s, setS] = useState<Settings>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")
  const [preview, setPreview] = useState("")
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    api.getBotSettings()
      .then((b) => setS({
        bot_name: b.bot_name || "",
        bot_tone: b.bot_tone || "professional_friendly",
        language_mode: b.language_mode || "auto",
        system_prompt: b.system_prompt || "",
        welcome_message: b.welcome_message || "",
        fallback_message: b.fallback_message || "",
        handover_message: b.handover_message || "",
        auto_handover_after: b.auto_handover_after || 0,
        quick_replies_enabled: b.quick_replies_enabled,
        typing_indicator_enabled: b.typing_indicator_enabled,
        fetch_customer_name: b.fetch_customer_name,
      }))
      .catch((e) => setMsg(e.message))
      .finally(() => setLoaded(true))
  }, [])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: v }))

  const save = async () => {
    setSaving(true)
    setMsg("")
    try {
      await api.updateBotSettings(s as unknown as Record<string, unknown>)
      setMsg("Saved — your bot now uses these settings on the next message.")
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const runPreview = async () => {
    setPreviewing(true)
    setPreview("")
    try {
      const r = await api.previewBot("What is the price of your laptop bag?")
      setPreview(r.prompt)
    } catch (e) {
      setPreview((e as Error).message)
    } finally {
      setPreviewing(false)
    }
  }

  if (!loaded) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Bot Settings</h1>
        <p className="text-muted-foreground mt-1">These settings apply to the Facebook page assigned to your account.</p>
      </div>

      {msg && <p className="text-sm text-primary">{msg}</p>}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Identity & Behavior</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bot_name">Bot name</Label>
              <Input id="bot_name" value={s.bot_name} onChange={(e) => set("bot_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bot_tone">Tone</Label>
              <select id="bot_tone" value={s.bot_tone} onChange={(e) => set("bot_tone", e.target.value)}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
                {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="language_mode">Language mode</Label>
              <select id="language_mode" value={s.language_mode} onChange={(e) => set("language_mode", e.target.value)}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="auto_handover_after">Auto handover after N messages (0 = off)</Label>
              <Input id="auto_handover_after" type="number" min={0} value={s.auto_handover_after}
                onChange={(e) => set("auto_handover_after", Number(e.target.value))} />
            </div>
            <div className="space-y-3 pt-2">
              {([
                ["quick_replies_enabled", "Quick replies"],
                ["typing_indicator_enabled", "Typing indicator"],
                ["fetch_customer_name", "Fetch customer name"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={s[key]} onChange={(e) => set(key, e.target.checked)} className="h-4 w-4" />
                  {label}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Messages</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="System prompt" value={s.system_prompt} onChange={(v) => set("system_prompt", v)} />
            <Field label="Welcome message" value={s.welcome_message} onChange={(v) => set("welcome_message", v)} />
            <Field label="Fallback message" value={s.fallback_message} onChange={(v) => set("fallback_message", v)} />
            <Field label="Handover message" value={s.handover_message} onChange={(v) => set("handover_message", v)} />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        <Button variant="outline" onClick={runPreview} disabled={previewing}>
          {previewing ? "Generating…" : "Preview prompt"}
        </Button>
      </div>

      {preview && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Generated prompt (preview)</CardTitle>
            <CardDescription>This is what the bot receives on the next incoming message.</CardDescription></CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-xs bg-muted rounded-lg p-4 max-h-96 overflow-auto">{preview}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)}
        rows={3} className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-y" />
    </div>
  )
}
