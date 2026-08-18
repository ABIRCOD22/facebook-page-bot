"use client"

import { useEffect, useState } from "react"
import { Plus, Search, Pencil, Trash2, BookOpen, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"

type Article = {
  id: string
  title: string
  content: string
  category: string
  is_active: boolean
}

const EMPTY = { title: "", content: "", category: "general" }

export default function KnowledgePage() {
  const [items, setItems] = useState<Article[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Article | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")

  const fetchKnowledge = (s = "") => {
    setLoading(true)
    api.listKnowledge(s)
      .then((r) => setItems(r.items as Article[]))
      .catch((e) => setMsg(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchKnowledge() }, [])

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowForm(true) }
  const openEdit = (a: Article) => {
    setEditing(a)
    setForm({ title: a.title, content: a.content, category: a.category })
    setShowForm(true)
  }

  const save = async () => {
    setSaving(true); setMsg("")
    try {
      if (editing) await api.updateKnowledge(editing.id, form)
      else await api.createKnowledge(form)
      setShowForm(false)
      fetchKnowledge(search)
      setMsg(editing ? "Article updated." : "Article added.")
    } catch (e) { setMsg((e as Error).message) } finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this article?")) return
    await api.deleteKnowledge(id)
    fetchKnowledge(search)
  }

  const toggle = async (a: Article) => {
    await api.toggleKnowledge(a.id)
    fetchKnowledge(search)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Knowledge Base</h1>
          <p className="text-muted-foreground mt-1">FAQs, policies and facts the bot uses to answer customers.</p>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4" /> Add article</Button>
      </div>

      {msg && <p className="text-sm text-primary">{msg}</p>}

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search articles…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchKnowledge(search)} className="pl-9" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-medium">No articles yet</p>
            <p className="text-sm">Teach the bot about shipping, returns, or anything customers ask.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((a) => (
            <Card key={a.id} className="hover:border-primary/40 transition-colors">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{a.title}</h3>
                    <Badge variant="outline">{a.category}</Badge>
                    {!a.is_active && <Badge variant="warning">Paused</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{a.content}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => toggle(a)}>{a.is_active ? "Pause" : "Activate"}</Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(a)} aria-label="Edit"><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(a.id)} aria-label="Delete"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowForm(false)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{editing ? "Edit article" : "New article"}</h2>
                <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-muted cursor-pointer" aria-label="Close"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="k-title">Title</Label>
                <Input id="k-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Shipping Policy" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="k-cat">Category</Label>
                <Input id="k-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="k-content">Content</Label>
                <textarea id="k-content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-y" placeholder="Write the answer the bot should give…" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
