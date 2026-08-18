"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Activity, Package, BookOpen, Bot } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { api } from "@/lib/api"

export default function OverviewPage() {
  const { user } = useAuth()
  const [pageName, setPageName] = useState<string | null>(null)
  const [productCount, setProductCount] = useState<number | null>(null)
  const [kbCount, setKbCount] = useState<number | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    api.getBotSettings().then((b) => setPageName(b.page_name)).catch(() => {})
    api.listProducts().then((r) => setProductCount(r.total)).catch(() => {})
    api.listKnowledge().then((r) => setKbCount(r.items.length)).catch(() => {})
  }, [])

  const stats = [
    { label: "Connected Page", value: pageName || "—", icon: Bot, href: "/dashboard/pages" },
    { label: "Products", value: productCount ?? "—", icon: Package, href: "/dashboard/products" },
    { label: "Knowledge Articles", value: kbCount ?? "—", icon: BookOpen, href: "/dashboard/knowledge" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
          Welcome back, {user?.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-muted-foreground mt-1 flex items-center gap-2">
          <Activity className="w-4 h-4" /> Your auto-reply bot is configured per page.
        </p>
        {error && <p className="text-destructive text-sm mt-2">{error}</p>}
        {pageName === null && !error && (
          <div className="mt-3 p-3 rounded-xl border border-amber-300 bg-amber-50 text-sm flex items-center justify-between gap-3">
            <span className="text-amber-800">Your bot is idle — connect a Facebook page to go live.</span>
            <Link prefetch={false} href="/dashboard/pages">
              <Button size="sm" variant="outline">Connect a page</Button>
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Link prefetch={false} key={s.label} href={s.href}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <s.icon className="w-5 h-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold truncate">{s.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick start</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link prefetch={false} href="/dashboard/settings"><Button>Configure bot</Button></Link>
          <Link prefetch={false} href="/dashboard/products"><Button variant="outline">Add products</Button></Link>
          <Link prefetch={false} href="/dashboard/knowledge"><Button variant="outline">Teach the bot</Button></Link>
        </CardContent>
      </Card>
    </div>
  )
}
