"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { Sidebar } from "@/components/sidebar"
import { Loader2 } from "lucide-react"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!localStorage.getItem("token")) return
    api
      .getSubscription()
      .then((sub) => {
        if (sub.payment_required) router.replace("/payment")
      })
      .catch(() => {})
  }, [router])

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <main className="lg:ml-64 p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
