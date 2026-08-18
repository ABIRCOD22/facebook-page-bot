const API_BASE = process.env.NEXT_PUBLIC_ADMIN_API_URL || "http://localhost:8000"

export interface AdminUser {
  id: string
  email: string
  full_name: string
  role: string
  is_active?: boolean
  two_factor_enabled?: boolean
}

interface ApiError {
  detail: string
}

class AdminApiClient {
  private baseUrl: string = API_BASE

  private getToken(): string | null {
    if (typeof window === "undefined") return null
    return localStorage.getItem("admin_token")
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken()
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    }
    if (token) headers["Authorization"] = `Bearer ${token}`

    const res = await fetch(`${this.baseUrl}${path}`, { ...options, headers })
    if (res.status === 204) return undefined as T
    if (!res.ok) {
      const error: ApiError = await res.json().catch(() => ({ detail: "Request failed" }))
      throw new Error(error.detail || `HTTP ${res.status}`)
    }
    return res.json()
  }

  // ---- Auth (2FA) ----
  async adminLogin(email: string, password: string) {
    return this.request<{
      requires_2fa: boolean
      temp_token?: string
      access_token?: string
      user?: AdminUser
    }>("/api/admin/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })
  }

  async adminVerify2fa(tempToken: string, code: string) {
    return this.request<{ access_token: string; user: AdminUser }>("/api/admin/auth/verify-2fa", {
      method: "POST",
      body: JSON.stringify({ temp_token: tempToken, code }),
    })
  }

  async adminSetup2fa() {
    return this.request<{ otpauth_uri: string; secret: string }>("/api/admin/auth/setup-2fa", { method: "POST" })
  }

  async adminMe() {
    return this.request<AdminUser>("/api/admin/auth/me")
  }

  // ---- Overview ----
  async getOverview() {
    return this.request<Record<string, any>>("/api/admin/overview")
  }

  // ---- Users ----
  async getUsers(search?: string, limit = 25, offset = 0) {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (search) qs.set("search", search)
    return this.request<{ total: number; limit: number; offset: number; users: any[] }>(`/api/admin/users?${qs}`)
  }

  async getUser(id: string) {
    return this.request<any>(`/api/admin/users/${id}`)
  }

  async createUser(body: Record<string, any>) {
    return this.request<{ ok: boolean; id: string }>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  async suspendUser(id: string, reason?: string) {
    return this.request<{ ok: boolean }>(`/api/admin/users/${id}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || "" }),
    })
  }

  async activateUser(id: string) {
    return this.request<{ ok: boolean }>(`/api/admin/users/${id}/activate`, { method: "POST" })
  }

  async deleteUser(id: string) {
    return this.request<{ ok: boolean }>(`/api/admin/users/${id}`, { method: "DELETE" })
  }

  async updateSubscription(id: string, body: Record<string, any>) {
    return this.request<{ ok: boolean; subscription: any }>(`/api/admin/users/${id}/subscription`, {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  async impersonate(id: string) {
    return this.request<{ access_token: string; user: AdminUser }>(`/api/admin/users/${id}/impersonate`, {
      method: "POST",
    })
  }

  // ---- Subscriptions ----
  async getSubscriptions(status?: string, tier?: string, limit = 25, offset = 0) {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (status) qs.set("status_filter", status)
    if (tier) qs.set("tier", tier)
    return this.request<{ total: number; subscriptions: any[] }>(`/api/admin/subscriptions?${qs}`)
  }

  // ---- Bots ----
  async getBots(status?: string, limit = 25, offset = 0) {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (status) qs.set("status_filter", status)
    return this.request<{ total: number; bots: any[] }>(`/api/admin/bots?${qs}`)
  }

  async pauseBot(pageId: string) {
    return this.request<{ ok: boolean; is_active: boolean }>(`/api/admin/bots/${pageId}/pause`, { method: "POST" })
  }

  async resumeBot(pageId: string) {
    return this.request<{ ok: boolean; is_active: boolean }>(`/api/admin/bots/${pageId}/resume`, { method: "POST" })
  }

  // ---- Conversations ----
  async getConversations(search?: string, limit = 25, offset = 0) {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (search) qs.set("search", search)
    return this.request<{ total: number; conversations: any[] }>(`/api/admin/conversations?${qs}`)
  }

  async getConversationMessages(id: string) {
    return this.request<{ conversation: any; messages: any[] }>(`/api/admin/conversations/${id}`)
  }

  async flagConversation(id: string, flag: boolean) {
    return this.request<{ ok: boolean }>(`/api/admin/conversations/${id}/flag`, {
      method: "POST",
      body: JSON.stringify({ flag }),
    })
  }

  async deleteConversation(id: string) {
    return this.request<{ ok: boolean }>(`/api/admin/conversations/${id}`, { method: "DELETE" })
  }

  // ---- Analytics ----
  async getAnalytics() {
    return this.request<any>("/api/admin/analytics")
  }

  // ---- Revenue ----
  async getRevenue() {
    return this.request<any>("/api/admin/revenue")
  }

  async getPayouts() {
    return this.request<{ payouts: any[] }>("/api/admin/revenue/payouts")
  }

  async updatePayoutStatus(id: string, status: string) {
    return this.request<{ ok: boolean }>(`/api/admin/revenue/payouts/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    })
  }

  // ---- KB Templates ----
  async getKbTemplates(search?: string) {
    const qs = search ? `?search=${encodeURIComponent(search)}` : ""
    return this.request<{ templates: any[] }>(`/api/admin/kb-templates${qs}`)
  }

  async createKbTemplate(body: Record<string, any>) {
    return this.request<{ id: string }>("/api/admin/kb-templates", { method: "POST", body: JSON.stringify(body) })
  }

  async updateKbTemplate(id: string, body: Record<string, any>) {
    return this.request<{ ok: boolean }>(`/api/admin/kb-templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })
  }

  async deleteKbTemplate(id: string) {
    return this.request<{ ok: boolean }>(`/api/admin/kb-templates/${id}`, { method: "DELETE" })
  }

  async applyKbTemplate(id: string, target: string) {
    return this.request<{ ok: boolean; pushed: number }>(`/api/admin/kb-templates/${id}/apply`, {
      method: "POST",
      body: JSON.stringify({ target }),
    })
  }

  // ---- Settings & Alerts ----
  async getSettings() {
    return this.request<any>("/api/admin/settings")
  }

  async updateSettings(body: Record<string, any>) {
    return this.request<{ ok: boolean }>("/api/admin/settings", { method: "PUT", body: JSON.stringify(body) })
  }

  async getAlerts() {
    return this.request<{ alerts: any[] }>("/api/admin/alerts")
  }

  async resolveAlert(id: string) {
    return this.request<{ ok: boolean }>(`/api/admin/alerts/${id}/resolve`, { method: "PUT" })
  }

  async retryWebhooks() {
    return this.request<{ ok: boolean; retried: number }>("/api/admin/webhooks/retry", { method: "POST" })
  }

  async testWebhook(url: string) {
    return this.request<{ ok: boolean; status: number }>("/api/admin/webhooks/test", {
      method: "POST",
      body: JSON.stringify({ url }),
    })
  }
}

export const adminApi = new AdminApiClient()
