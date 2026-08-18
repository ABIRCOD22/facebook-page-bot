"use client"

import { useEffect, useState } from "react"
import { FileText, Plus, Send, Trash2, Pencil } from "lucide-react"
import { adminApi } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function KbTemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([])
  const [editing, setEditing] = useState<any | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: "", content: "", category: "general" })
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    const r = await adminApi.getKbTemplates()
    setTemplates(r.templates)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.title || !form.content) return alert("Title and content required")
    setBusy("save")
    try {
      if (editing) await adminApi.updateKbTemplate(editing.id, form)
      else await adminApi.createKbTemplate(form)
      setForm({ title: "", content: "", category: "general" })
      setShowForm(false)
      setEditing(null)
      await load()
    } finally {
      setBusy(null)
    }
  }

  const edit = (t: any) => {
    setEditing(t)
    setForm({ title: t.title, content: t.content, category: t.category })
    setShowForm(true)
  }

  const del = async (id: string) => {
    if (!confirm("Delete this template?")) return
    setBusy(id)
    try { await adminApi.deleteKbTemplate(id); await load() } finally { setBusy(null) }
  }

  const apply = async (id: string) => {
    if (!confirm("Push this template into EVERY user's knowledge base?")) return
    setBusy("apply" + id)
    try {
      const r = await adminApi.applyKbTemplate(id, "all")
      alert(`Pushed to ${r.pushed} users.`)
    } finally { setBusy(null) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
            <FileText className="w-6 h-6 text-primary" /> KB Templates
          </h1>
          <p className="text-sm text-muted-foreground">Push canned knowledge to all users.</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ title: "", content: "", category: "general" }); setShowForm((v) => !v) }}>
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Content</Label>
              <textarea
                className="w-full min-h-[140px] rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={busy === "save"}>Save</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{t.title}</p>
                  <Badge variant="secondary" className="mt-1">{t.category}</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{t.content}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => edit(t)} disabled={busy === t.id}><Pencil className="w-4 h-4" /> Edit</Button>
                <Button size="sm" variant="outline" onClick={() => apply(t.id)} disabled={busy === "apply" + t.id}><Send className="w-4 h-4" /> Push to all</Button>
                <Button size="sm" variant="ghost" onClick={() => del(t.id)} disabled={busy === t.id}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && <p className="text-muted-foreground col-span-full">No templates yet.</p>}
      </div>
    </div>
  )
}
