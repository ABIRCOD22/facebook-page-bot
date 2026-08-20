"use client"

import { useEffect, useState } from "react"
import { MessageSquare, Send, Search, Loader2, Undo2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"

interface Conv {
  id: string
  customer_name: string
  status: string
  taken_over_at: string | null
  message_count: number
  last_message_at: string
  preview: string
  preview_sender: string | null
}

interface Msg {
  id: string
  sender_type: string
  content: string
  message_type: string
  timestamp: string
}

export default function ConversationsPage() {
  const [convs, setConvs] = useState<Conv[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [convInfo, setConvInfo] = useState<{ status: string; taken_over_at: string | null } | null>(null)
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [error, setError] = useState("")

  async function loadConvs() {
    try {
      const res = await api.listConversations()
      setConvs(res.conversations)
      if (!selected && res.conversations.length > 0) {
        setSelected(res.conversations[0].id)
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadConvs()
  }, [])

  useEffect(() => {
    if (!selected) {
      setMessages([])
      return
    }
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const res = await api.getConversation(selected)
        if (active) {
          setMessages(res.messages)
          setConvInfo({ status: res.status, taken_over_at: res.taken_over_at })
        }
      } catch {
        /* ignore */
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [selected])

  async function handleSend() {
    if (!selected || !draft.trim()) return
    setSending(true)
    setError("")
    try {
      await api.sendConversationMessage(selected, draft.trim())
      setDraft("")
      const res = await api.getConversation(selected)
      setMessages(res.messages)
      setConvInfo({ status: res.status, taken_over_at: res.taken_over_at })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  async function handleResume(id: string | null) {
    if (!selected || !id || resuming) return
    setResuming(true)
    setError("")
    try {
      await api.resumeConversation(id)
      const res = await api.getConversation(id)
      setMessages(res.messages)
      setConvInfo({ status: res.status, taken_over_at: res.taken_over_at })
      await loadConvs()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setResuming(false)
    }
  }

  const handedOver = convInfo?.status === "handed_over" && convInfo.taken_over_at

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Conversations</h1>
        <p className="text-muted-foreground mt-1">Live and historical chats between your bot and customers.</p>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid md:grid-cols-[300px_1fr] min-h-[520px]">
            <div className="border-r">
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search…" className="pl-9" />
                </div>
              </div>
              <div className="divide-y max-h-[470px] overflow-y-auto">
                {convs.length === 0 && (
                  <div className="p-6 text-center text-muted-foreground">
                    <MessageSquare className="w-9 h-9 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No conversations yet</p>
                    <p className="text-xs mt-1">Incoming messages from your Facebook page will appear here.</p>
                  </div>
                )}
                {convs.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c.id)}
                    className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
                      selected === c.id ? "bg-muted/60" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{c.customer_name}</p>
                      {c.status === "handed_over" && c.taken_over_at ? (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 shrink-0">
                          You
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(c.last_message_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.preview_sender === "bot" ? "🤖 " : c.preview_sender === "human_agent" ? "👤 " : ""}
                      {c.preview || "No messages"}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[440px]">
                {loading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                    <div>
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <MessageSquare className="w-7 h-7 text-primary" />
                      </div>
                      <p className="font-medium">Select a conversation</p>
                      <p className="text-sm">Customer messages and bot replies will stream in here.</p>
                    </div>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isCustomer = m.sender_type === "customer"
                    return (
                      <div key={m.id} className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                            isCustomer
                              ? "bg-muted"
                              : m.sender_type === "human_agent"
                                ? "bg-primary text-primary-foreground"
                                : "bg-[#1877F2] text-white"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          <p className="text-[10px] opacity-70 mt-1 text-right">
                            {new Date(m.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="p-4 border-t">
                {error && <p className="text-xs text-destructive mb-2">{error}</p>}
                {handedOver && (
                  <div className="flex items-center justify-between gap-3 mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                    <p className="text-xs text-amber-800">
                      You have taken over this customer — the bot stays silent here and keeps serving the others.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResume(selected)}
                      disabled={resuming}
                    >
                      {resuming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
                      Get back to bot
                    </Button>
                  </div>
                )}
                <div className="relative">
                  <Input
                    placeholder="Message the customer…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    className="pr-12"
                  />
                  <Button
                    size="icon"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2"
                    onClick={handleSend}
                    disabled={sending || !draft.trim()}
                    aria-label="Send"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
