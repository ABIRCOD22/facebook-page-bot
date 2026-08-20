"use client"

import { useEffect, useState } from "react"
import { Loader2, ScanSearch, Power, Trash2, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"

interface BusinessProfile {
  page_name: string
  category: string
  summary: string
  tone: string
  style: string
  product_terms: string[]
  website_url: string
}

interface Page {
  id: string
  page_id: string
  page_name: string
  bot_name: string
  bot_enabled: boolean
  is_active: boolean
  connected_at: string
  scan_status: string
  scanned_at: string | null
  business_profile: BusinessProfile | null
}

export default function PagesPage() {
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)
  const [scanningId, setScanningId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function load() {
    try {
      const res = await api.listPages()
      setPages(res.pages)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleScan(id: string) {
    setError("")
    setScanningId(id)
    try {
      const res = await api.scanPage(id)
      setSuccess(
        `Business scan complete: ${res.profile.page_name ?? "page"} profiled, ${res.kb_added} knowledge entries added from ${res.posts_scanned} posts.`
      )
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setScanningId(null)
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

  async function handleToggleBot(id: string, current: boolean) {
    setError("")
    setTogglingId(id)
    try {
      await api.setBotEnabled(id, !current)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>My Pages</h1>
        <p className="text-muted-foreground mt-1">The Facebook pages connected to your bot.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="w-12 h-12 rounded-xl bg-[#1877F2]/10 flex items-center justify-center mb-2">
            <ShieldCheck className="w-6 h-6 text-[#1877F2]" />
          </div>
          <CardTitle className="text-lg">Connected pages</CardTitle>
          <CardDescription>
            Your pages are set up by the ChatriX team. Use the controls here to run a business scan or pause your bot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && pages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No pages connected yet. Contact the ChatriX team to connect your Facebook page.
            </p>
          )}
          {pages.map((p) => (
            <div key={p.id} className="p-3 rounded-xl border">
              <div className="flex items-center gap-3">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    p.bot_enabled ? "bg-emerald-500" : "bg-muted-foreground/40"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.page_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.bot_name}</p>
                </div>
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                  {p.scan_status}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleBot(p.id, p.bot_enabled)}
                  disabled={togglingId === p.id}
                  title={p.bot_enabled ? "Turn bot service off for this page" : "Turn bot service on for this page"}
                >
                  {togglingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                  {p.bot_enabled ? "ON" : "OFF"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleScan(p.id)}
                  disabled={scanningId === p.id}
                >
                  {scanningId === p.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ScanSearch className="w-4 h-4" />
                  )}
                  {p.business_profile ? "Re-scan" : "Scan business"}
                </Button>
                <Button size="icon" variant="ghost" aria-label="Disconnect" onClick={() => handleDisconnect(p.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              {p.business_profile && (
                <div className="mt-3 pt-3 border-t text-sm space-y-2">
                  <p className="text-xs text-muted-foreground">{p.business_profile.summary}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-[#1877F2]/10 text-[#1877F2] capitalize">tone: {p.business_profile.tone}</span>
                    {p.business_profile.website_url && (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground break-all">{p.business_profile.website_url}</span>
                    )}
                  </div>
                  {p.business_profile.product_terms.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Offers detected: {p.business_profile.product_terms.slice(0, 3).map((t) => `"${t}…"`).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}
        </CardContent>
      </Card>
    </div>
  )
}