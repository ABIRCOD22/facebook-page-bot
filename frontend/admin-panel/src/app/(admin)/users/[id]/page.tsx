"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft, Ban, CheckCircle2, Trash2, KeyRound, Bot, Boxes, FileText, MessageSquare,
} from "lucide-react"
import { adminApi } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function UserDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const [u, setU] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [editSub, setEditSub] = useState(false)
  const [sub, setSub] = useState({ tier: "", status: "", messages_limit: 0, messages_used: 0 })

  const load = async () => {
    setLoading(true)
    try {
      const d = await adminApi.getUser(id)
      setU(d)
      if (d.subscription) {
        setSub({
          tier: d.subscription.tier,
          status: d.subscription.status,
          messages_limit: d.subscription.messages_limit ?? 0,
          messages_used: d.subscription.messages_used ?? 0,
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const act = async (kind: "suspend" | "activate" | "delete") => {
    if (kind === "delete" && !confirm("Permanently delete this user and all their data?")) return
    if (kind === "suspend" && !confirm("Suspend this user (and their subscription)?")) return
    setBusy(kind)
    try {
      if (kind === "suspend") await adminApi.suspendUser(id, "Suspended by admin")
      if (kind === "activate") await adminApi.activateUser(id)
      if (kind === "delete") { await adminApi.deleteUser(id); router.push("/admin/users"); return }
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed")
    } finally {
      setBusy(null)
    }
  }

  const saveSub = async () => {
    setBusy("sub")
    try {
      await adminApi.updateSubscription(id, sub)
      setEditSub(false)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed")
    } finally {
      setBusy(null)
    }
  }

  const impersonate = async () => {
    setBusy("imp")
    try {
      const r = await adminApi.impersonate(id)
      // ponytail: hand the client token to the user app on its own domain via localStorage.
      window.open(`http://localhost:3000/?admin_token=${r.access_token}`, "_blank")
    } catch (e) {
      alert(e instanceof Error ? e.message : "Impersonate failed")
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading…</p>
  if (!u) return <p className="text-muted-foreground">User not found.</p>

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm"><Link href="/admin/users"><ArrowLeft className="w-4 h-4" /> Back to users</Link></Button>

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>{u.full_name || "—"}</h1>
          <p className="text-sm text-muted-foreground">{u.email}</p>
          <div className="flex gap-2 mt-2">
            <Badge variant={u.is_active ? "success" : "destructive"}>{u.is_active ? "Active" : "Suspended"}</Badge>
            <Badge variant="outline">{u.role}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={impersonate} disabled={busy === "imp"}><KeyRound className="w-4 h-4" /> Login as user</Button>
          {u.is_active ? (
            <Button variant="outline" onClick={() => act("suspend")} disabled={busy === "suspend"}><Ban className="w-4 h-4 text-amber-500" /> Suspend</Button>
          ) : (
            <Button variant="outline" onClick={() => act("activate")} disabled={busy === "activate"}><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Activate</Button>
          )}
          <Button variant="destructive" onClick={() => act("delete")} disabled={busy === "delete"}><Trash2 className="w-4 h-4" /> Delete</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={<Bot className="w-5 h-5" />} label="Pages" value={u.pages.length} />
        <Stat icon={<Boxes className="w-5 h-5" />} label="Products" value={u.counts.products} />
        <Stat icon={<FileText className="w-5 h-5" />} label="KB Bases" value={u.counts.knowledge_bases} />
        <Stat icon={<MessageSquare className="w-5 h-5" />} label="Conversations" value={u.counts.conversations} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Subscription</CardTitle>
          {u.subscription && (
            <Button variant="outline" size="sm" onClick={() => setEditSub((v) => !v)}>
              {editSub ? "Cancel" : "Edit"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!u.subscription && <p className="text-sm text-muted-foreground">No subscription record.</p>}
          {u.subscription && !editSub && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Field label="Tier" value={u.subscription.tier} />
              <Field label="Status" value={<Badge variant={u.subscription.status === "active" ? "success" : "warning"}>{u.subscription.status}</Badge>} />
              <Field label="Messages" value={`${u.subscription.messages_used} / ${u.subscription.messages_limit ?? "∞"}`} />
              <Field label="Ends" value={u.subscription.ends_at ? u.subscription.ends_at.slice(0, 10) : "—"} />
            </div>
          )}
          {u.subscription && editSub && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label>Tier</Label>
                <Input value={sub.tier} onChange={(e) => setSub({ ...sub, tier: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Input value={sub.status} onChange={(e) => setSub({ ...sub, status: e.target.value })} placeholder="active/suspended" />
              </div>
              <div className="space-y-1">
                <Label>Limit</Label>
                <Input type="number" value={sub.messages_limit} onChange={(e) => setSub({ ...sub, messages_limit: +e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Used</Label>
                <Input type="number" value={sub.messages_used} onChange={(e) => setSub({ ...sub, messages_used: +e.target.value })} />
              </div>
              <Button className="col-span-full w-fit" onClick={saveSub} disabled={busy === "sub"}>Save subscription</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Connected Pages</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {u.pages.length === 0 && <p className="text-sm text-muted-foreground">No Facebook pages connected.</p>}
          {u.pages.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">ID: {p.page_id}</p>
              </div>
              <Badge variant={p.is_active ? "success" : "destructive"}>{p.is_active ? "Active" : "Paused"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
        <div>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="font-medium mt-0.5">{value}</div>
    </div>
  )
}
