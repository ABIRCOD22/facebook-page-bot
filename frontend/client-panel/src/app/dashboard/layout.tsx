"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"

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

  return <>{children}</>
}
