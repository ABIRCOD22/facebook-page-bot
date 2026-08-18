"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { MessageSquare, Search, RefreshCw } from "lucide-react"
import { adminApi } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const LIMIT = 20

export default function ConversationsPage() {
  const [convos, setConvos] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await adminApi.getConversations(search || undefined, LIMIT, offset)
      setConvos(r.conversations)
      setTotal(r.total)
    } finally {
      setLoading(false)
    }
  }, [search, offset])

  useEffect(() => { load() }, [load])
  useEffect(() => { const id = setInterval(load, 15000); return () => clearInterval(id) }, [load])

  const pages = Math.ceil(total / LIMIT)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
            <MessageSquare className="w-6 h-6 text-primary" /> Conversations
          </h1>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search customer…" value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0) }} className="pl-9 w-64" />
          </div>
          <Button variant="outline" size="icon" onClick={load} title="Refresh"><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Customer</th>
                  <th className="text-left font-medium px-4 py-3">Page</th>
                  <th className="text-left font-medium px-4 py-3">Owner</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-left font-medium px-4 py-3">Messages</th>
                  <th className="text-right font-medium px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {convos.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.customer_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{c.customer_fb_id}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.page_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.owner_email || "—"}</td>
                    <td className="px-4 py-3"><Badge variant={c.status === "active" ? "success" : "outline"}>{c.status}</Badge></td>
                    <td className="px-4 py-3">{c.message_count}</td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="ghost" size="sm"><Link href={`/admin/conversations/conversation-detail?id=${c.id}`}>View</Link></Button>
                    </td>
                  </tr>
                ))}
                {!loading && convos.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No conversations.</td></tr>
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
