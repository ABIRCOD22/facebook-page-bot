const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://facebook-page-bot-rdkt.onrender.com"

interface AuthResponse {
  access_token: string
  token_type: string
  user: {
    id: number
    email: string
    full_name: string
    role: string
  }
}

interface ApiError {
  detail: string
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private getToken(): string | null {
    if (typeof window === "undefined") return null
    return localStorage.getItem("token")
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken()
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    }
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    // Render free tier sleeps after ~15 min idle; the first request wakes it
    // and can take 30-60s to come back. Retry network-level failures
    // (TypeError) with a per-attempt timeout covering the wake window — HTTP
    // errors pass through untouched.
    let response: Response | null = null
    let lastErr: unknown
    for (let attempt = 0; attempt <= 2; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 90_000)
      try {
        response = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          headers,
          signal: controller.signal,
        })
        break
      } catch (err) {
        lastErr = err
        if (attempt < 2) await new Promise((r) => setTimeout(r, 2500))
      } finally {
        clearTimeout(timer)
      }
    }
    if (!response) throw lastErr
    const res = response

    if (!res.ok) {
      const error: ApiError = await res.json().catch(() => ({ detail: "Request failed" }))
      throw new Error(error.detail || `HTTP ${res.status}`)
    }

    return res.json()
  }

  async register(email: string, password: string, fullName: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/api/client/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, full_name: fullName }),
    })
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/api/client/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  }

  async getMe() {
    return this.request<{ id: number; email: string; full_name: string; role: string; is_active: boolean }>("/api/client/auth/me")
  }

  async getSubscription() {
    return this.request<{
      tier: string | null
      status: string
      is_trial: boolean
      payment_required: boolean
      days_remaining: number
      expires_at: string | null
      started_at: string | null
      max_messages_per_month: number
      messages_used: number
      payment_url: string | null
    }>("/api/client/subscription")
  }

  // ---- Bot settings ----
  async getBotSettings() {
    return this.request<{
      page_id: string
      page_name: string
      bot_name: string
      bot_tone: string
      language_mode: string
      system_prompt: string
      welcome_message: string | null
      fallback_message: string | null
      handover_message: string
      auto_handover_after: number
      quick_replies_enabled: boolean
      typing_indicator_enabled: boolean
      fetch_customer_name: boolean
    }>("/api/client/bot")
  }

  async updateBotSettings(body: Record<string, unknown>) {
    return this.request<{ status: string; message: string }>("/api/client/bot", {
      method: "PUT",
      body: JSON.stringify(body),
    })
  }

  async previewBot(sampleMessage: string) {
    return this.request<{ prompt: string; page_config: Record<string, unknown> }>("/api/client/bot/preview", {
      method: "POST",
      body: JSON.stringify({ sample_message: sampleMessage }),
    })
  }

  // ---- Products ----
  async listProducts(search = "") {
    const qs = search ? `?search=${encodeURIComponent(search)}` : ""
    return this.request<{ products: Array<Record<string, unknown>>; total: number; page: number; per_page: number }>(`/api/client/products${qs}`)
  }

  async createProduct(body: Record<string, unknown>) {
    return this.request<{ id: string; status: string }>("/api/client/products", {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  async updateProduct(id: string, body: Record<string, unknown>) {
    return this.request<{ status: string }>(`/api/client/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })
  }

  async deleteProduct(id: string) {
    return this.request<{ status: string }>(`/api/client/products/${id}`, { method: "DELETE" })
  }

  async scanProducts() {
    return this.request<{ imported: number; skipped: number; total_found: number }>("/api/client/scan-products", {
      method: "POST",
    })
  }

  // ---- Knowledge ----
  async listKnowledge(search = "") {
    const qs = search ? `?search=${encodeURIComponent(search)}` : ""
    return this.request<{ items: Array<Record<string, unknown>>; page: number; per_page: number }>(`/api/client/knowledge${qs}`)
  }

  async createKnowledge(body: Record<string, unknown>) {
    return this.request<{ id: string; status: string }>("/api/client/knowledge", {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  async updateKnowledge(id: string, body: Record<string, unknown>) {
    return this.request<{ status: string }>(`/api/client/knowledge/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })
  }

  async deleteKnowledge(id: string) {
    return this.request<{ status: string }>(`/api/client/knowledge/${id}`, { method: "DELETE" })
  }

  async toggleKnowledge(id: string) {
    return this.request<{ status: string; is_active: boolean }>(`/api/client/knowledge/${id}/toggle`, { method: "PUT" })
  }

  // ---- Facebook pages (BYOA) ----
  async connectPage(pageAccessToken: string, fbAppId?: string, fbAppSecret?: string) {
    return this.request<{ status: string; id: string; page_id: string; page_name: string; verify_token: string | null }>("/api/client/pages/connect", {
      method: "POST",
      body: JSON.stringify({
        page_access_token: pageAccessToken,
        fb_app_id: fbAppId || undefined,
        fb_app_secret: fbAppSecret || undefined,
      }),
    })
  }

  async connectByoApp(appId: string, appSecret: string, code: string, redirectUri: string) {
    return this.request<{ status: string; id: string; page_id: string; page_name: string }>("/api/client/pages/connect-byo", {
      method: "POST",
      body: JSON.stringify({ app_id: appId, app_secret: appSecret, code, redirect_uri: redirectUri }),
    })
  }

  async listPages() {
    return this.request<{
      pages: Array<{
        id: string
        page_id: string
        page_name: string
        bot_name: string
        is_active: boolean
        connected_at: string
        scan_status: string
        scanned_at: string | null
        business_profile: {
          page_name: string
          category: string
          summary: string
          tone: string
          style: string
          product_terms: string[]
          website_url: string
        } | null
      }>
    }>("/api/client/pages")
  }

  async scanPage(id: string) {
    return this.request<{ status: string; profile: Record<string, unknown>; kb_added: number; posts_scanned: number; website_scanned: boolean }>(`/api/client/pages/${id}/scan`, { method: "POST" })
  }

  async disconnectPage(id: string) {
    return this.request<{ status: string }>(`/api/client/pages/${id}`, { method: "DELETE" })
  }

  // ---- Conversations inbox ----
  async listConversations() {
    return this.request<{ conversations: Array<{ id: string; customer_name: string; status: string; message_count: number; last_message_at: string; preview: string; preview_sender: string | null }> }>("/api/client/conversations")
  }

  async getConversation(id: string) {
    return this.request<{ id: string; customer_name: string; status: string; messages: Array<{ id: string; sender_type: string; content: string; message_type: string; timestamp: string }> }>(`/api/client/conversations/${id}`)
  }

  async sendConversationMessage(id: string, content: string) {
    return this.request<{ status: string }>(`/api/client/conversations/${id}/send`, {
      method: "POST",
      body: JSON.stringify({ content }),
    })
  }

  // ---- Dashboard stats ----
  async getStats() {
    return this.request<{
      conversations_today: number
      messages_today: number
      bot_responses_today: number
      avg_response_time_ms: number
      active_conversations: number
      total_conversations: number
      messages_7d: Array<{ date: string; count: number }>
      bot_status: string
      connected_page: string | null
    }>("/api/client/stats")
  }
}

export const api = new ApiClient(API_BASE)
