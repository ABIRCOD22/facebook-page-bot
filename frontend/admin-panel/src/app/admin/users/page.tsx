"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Search, Ban, CheckCircle2, Trash2, Eye, Users, RefreshCw, UserPlus, X, Copy } from "lucide-react"
import { adminApi } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const LIMIT = 20

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newUser, setNewUser] = useState({ email: "", full_name: "", password: "", tier: "" })
  const [saving, setSaving] = useState(false)
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await adminApi.getUsers(search || undefined, LIMIT, offset)
      setUsers(r.users)
      setTotal(r.total)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [search, offset])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [load])

  const act = async (id: string, kind: "suspend" | "activate" | "delete") => {
    if (kind === "delete" && !confirm("Permanently delete this user and all their data?")) return
    if (kind === "suspend" && !confirm("Suspend this user (and their subscription)?")) return
    setBusy(id + kind)
    try {
      if (kind === "suspend") await adminApi.suspendUser(id, "Suspended by admin")
      if (kind === "activate") await adminApi.activateUser(id)
      if (kind === "delete") await adminApi.deleteUser(id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed")
    } finally {
      setBusy(null)
    }
  }

  const pages = Math.ceil(total / LIMIT)

  const createUser = async () => {
    if (!newUser.email) {
      alert("Email is required")
      return
    }
    setSaving(true)
    try {
      const r = await adminApi.createUser({
        email: newUser.email,
        password: newUser.password || null,
        full_name: newUser.full_name,
        tier: newUser.tier || null,
      })
      setCreatedCreds({ email: newUser.email, password: r.password || "" })
      setShowAdd(false)
      setNewUser({ email: "", full_name: "", password: "", tier: "" })
      setOffset(0)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Create failed")
    } finally {
      setSaving(false)
    }
  }

  const copyCreds = async () => {
    if (!createdCreds) return
    await navigator.clipboard.writeText(`${createdCreds.email}\n${createdCreds.password}`)
    alert("Copy-paste to your client: email + password")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
            <Users className="w-6 h-6 text-primary" /> Users
          </h1>
          <p className="text-sm text-muted-foreground">{total} total users</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search email or name…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0) }}
              className="pl-9 w-64"
            />
          </div>
          <Button variant="outline" size="icon" onClick={load} title="Refresh"><RefreshCw className="w-4 h-4" /></Button>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? <X className="w-4 h-4 mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
            {showAdd ? "Cancel" : "Add User"}
          </Button>
        </div>
      </div>

{showAdd && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Email *</Label>
                <Input type="email" placeholder="user@example.com" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Full name</Label>
                <Input placeholder="Jane Doe" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Password</Label>
                <Input type="password" placeholder="blank = auto-generate" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                <p className="text-[11px] text-muted-foreground mt-1">Leave empty to auto-generate a password</p>
              </div>
              <div>
                <Label className="text-xs">Tier</Label>
                <Input placeholder="pro (blank = free trial)" value={newUser.tier} onChange={(e) => setNewUser({ ...newUser, tier: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <Button size="sm" disabled={saving} onClick={createUser}>
                {saving ? "Creating…" : "Create user"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {createdCreds && (
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium text-emerald-600">User created — hand these credentials to your client</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><Label className="text-xs text-muted-foreground">Email</Label><p className="font-mono">{createdCreds.email}</p></div>
              <div><Label className="text-xs text-muted-foreground">Password</Label><p className="font-mono">{createdCreds.password || "—"}</p></div>
            </div>
            {createdCreds.password && (
              <Button size="sm" variant="outline" onClick={copyCreds}><Copy className="w-4 h-4 mr-1" /> Copy email + password</Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">User</th>
                  <th className="text-left font-medium px-4 py-3">Role</th>
                  <th className="text-left font-medium px-4 py-3">Plan</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-right font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">{u.role}</td>
                    <td className="px-4 py-3">
                      {u.subscription_tier ? (
                        <Badge variant="secondary">{u.subscription_tier}</Badge>
                      ) : (
                        <span className="text-muted-foreground">none</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.is_active ? "success" : "destructive"}>
                        {u.is_active ? "Active" : "Suspended"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" title="View">
                          <Link prefetch={false} href={`/admin/users/user-detail?id=${u.id}`}><Eye className="w-4 h-4" /></Link>
                        </Button>
                        {u.is_active ? (
                          <Button variant="ghost" size="icon" title="Suspend" disabled={busy === u.id + "suspend"} onClick={() => act(u.id, "suspend")}>
                            <Ban className="w-4 h-4 text-amber-500" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" title="Activate" disabled={busy === u.id + "activate"} onClick={() => act(u.id, "activate")}>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" title="Delete" disabled={busy === u.id + "delete"} onClick={() => act(u.id, "delete")}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Page {Math.floor(offset / LIMIT) + 1} of {pages || 1}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>Previous</Button>
          <Button variant="outline" size="sm" disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)}>Next</Button>
        </div>
      </div>
    </div>
  )
}
