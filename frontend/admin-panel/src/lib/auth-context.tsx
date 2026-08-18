"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { adminApi, type AdminUser } from "@/lib/api"

interface AuthContextType {
  user: AdminUser | null
  loading: boolean
  // 2FA intermediate state: password accepted, awaiting TOTP code
  twoFactor: { tempToken: string } | null
  login: (email: string, password: string) => Promise<{ requires2fa: boolean }>
  verify2fa: (code: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [twoFactor, setTwoFactor] = useState<{ tempToken: string } | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("admin_token")
    if (token) {
      adminApi
        .adminMe()
        .then(setUser)
        .catch(() => localStorage.removeItem("admin_token"))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const res = await adminApi.adminLogin(email, password)
    if (res.requires_2fa && res.temp_token) {
      setTwoFactor({ tempToken: res.temp_token })
      return { requires2fa: true }
    }
    if (res.access_token && res.user) {
      localStorage.setItem("admin_token", res.access_token)
      setUser(res.user)
    }
    return { requires2fa: false }
  }

  const verify2fa = async (code: string) => {
    if (!twoFactor) throw new Error("No 2FA session")
    const res = await adminApi.adminVerify2fa(twoFactor.tempToken, code)
    localStorage.setItem("admin_token", res.access_token)
    setUser(res.user)
    setTwoFactor(null)
  }

  const logout = () => {
    localStorage.removeItem("admin_token")
    setUser(null)
    setTwoFactor(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, twoFactor, login, verify2fa, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAdminAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAdminAuth must be used within AuthProvider")
  return ctx
}
