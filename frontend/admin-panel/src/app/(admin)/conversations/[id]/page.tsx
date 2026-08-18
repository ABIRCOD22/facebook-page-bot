"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Trash2 } from "lucide-react"
import { adminApi } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function ConversationDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.getConversationMessages(id).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  const del = async () => {
    if (!confirm("Delete this conversation and its messages?")) return
    await adminApi.deleteConversation(id)
    location.href = "/admin/conversations"
  }

  if (loading) return <p className="text-muted-foreground">Loading…</p>
  if (!data) return <p className="text-muted-foreground">Not found.</p>

  const { conversation, messages } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm"><Link href="/admin/conversations"><ArrowLeft className="w-4 h-4" /> Back</Link></Button>
        <Button variant="destructive" size="sm" onClick={del}><Trash2 className="w-4 h-4" /> Delete</Button>
      </div>

      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold">{conversation.customer_name || "Customer"}</h1>
        <Badge variant={conversation.status === "active" ? "success" : "outline"}>{conversation.status}</Badge>
      </div>

      <Card>
        <CardContent className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {messages.map((m: any) => {
            const isBot = m.sender_type === "bot" || m.sender_type === "human_agent"
            return (
              <div key={m.id} className={`flex ${isBot ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${isBot ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {m.content}
                  {m.image_url && <img src={m.image_url} alt="" className="mt-2 rounded-lg max-w-[200px]" />}
                  <p className="text-[10px] opacity-60 mt-1">{m.timestamp ? m.timestamp.slice(11, 16) : ""} · {m.sender_type}</p>
                </div>
              </div>
            )
          })}
          {messages.length === 0 && <p className="text-muted-foreground text-sm">No messages.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
