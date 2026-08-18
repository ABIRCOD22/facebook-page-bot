"use client"

import { useEffect, useState } from "react"
import { MessagesSquare, Link2, Trash2, Loader2, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

interface Page {
  id: string
  page_id: string
  page_name: string
  bot_name: string
  is_active: boolean
  connected_at: string
}

export default function PagesPage() {
  const [pages, setPages] = useState<Page[]>([])
  const [token, setToken] = useState("")
  const [appId, setAppId] = useState("")
  const [appSecret, setAppSecret] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function load() {
    try {
      const res = await api.listPages()
      setPages(res.pages)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleConnect() {
    setError("")
    setSuccess("")
    if (!token.trim()) {
      setError("Paste your Page Access Token to connect.")
      return
    }
    setLoading(true)
    try {
      await api.connectPage(token.trim(), appId.trim() || undefined, appSecret.trim() || undefined)
      setSuccess("Page connected — your bot is now live on that page.")
      setToken("")
      setAppId("")
      setAppSecret("")
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect(id: string) {
    setError("")
    try {
      await api.disconnectPage(id)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Page Connection</h1>
        <p className="text-muted-foreground mt-1">Connect the Facebook page your bot will answer on.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="w-12 h-12 rounded-xl bg-[#1877F2]/10 flex items-center justify-center mb-2">
              <MessagesSquare className="w-6 h-6 text-[#1877F2]" />
            </div>
            <CardTitle className="text-lg">Connect a page</CardTitle>
            <CardDescription>Paste a Page Access Token (long-lived) from your Facebook app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pat">Page Access Token *</Label>
              <Input
                id="pat"
                type="password"
                placeholder="EAAB…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aid">App ID (optional)</Label>
              <Input id="aid" placeholder="1234567890" value={appId} onChange={(e) => setAppId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sec">App Secret (optional)</Label>
              <Input
                id="sec"
                type="password"
                placeholder="Used to verify webhook signatures"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && (
              <p className="text-sm text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> {success}
              </p>
            )}

            <Button className="w-full" onClick={handleConnect} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Connect Facebook Page
            </Button>
            <p className="text-xs text-muted-foreground">
              The token is stored encrypted-at-rest per page and used only to read and reply to messages.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connected pages</CardTitle>
            <CardDescription>Each connected page runs its own configured bot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pages.length === 0 && (
              <p className="text-sm text-muted-foreground">No pages connected yet.</p>
            )}
            {pages.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.page_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.bot_name}</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Disconnect" onClick={() => handleDisconnect(p.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
