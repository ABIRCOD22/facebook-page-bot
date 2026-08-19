/**
 * api.ts — thin client for the public register endpoint. The marketing
 * site talks to the ChatriX backend only for account creation; the
 * freshly created user then logs in at the client panel.
 */
import { SITE } from "./site"

export interface RegisterPayload {
  email: string
  password: string
  full_name?: string
}

export interface RegisterResult {
  ok: boolean
  message?: string
  data?: unknown
  status?: number
}

/**
 * POST /api/client/auth/register
 * Mirrors the backend contract used by the client-panel register flow.
 */
export async function registerClientUser(payload: RegisterPayload): Promise<RegisterResult> {
  try {
    const res = await fetch(`${SITE.apiUrl}/api/client/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    let json: unknown = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    if (!res.ok) {
      const msg =
        (json && typeof json === "object" && "detail" in json
          ? String((json as { detail: unknown }).detail)
          : null) ||
        (json && typeof json === "object" && "message" in json
          ? String((json as { message: unknown }).message)
          : null) ||
        `Request failed (${res.status})`
      return { ok: false, message: msg, status: res.status }
    }
    return { ok: true, data: json, status: res.status }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof TypeError
          ? "Could not reach the server. Is the backend running on " + SITE.apiUrl + "?"
          : "Something went wrong. Please try again.",
    }
  }
}

export function clientPanelLoginUrl() {
  return SITE.clientPanelUrl
}

const CREDS_KEY = "chatrix_creds"
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"

/** Generates a 12-char human-readable password (system hands out the login). */
export function generatePassword(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  let out = ""
  for (const b of bytes) out += PASSWORD_CHARS[b % PASSWORD_CHARS.length]
  return out
}

export interface ClientCreds {
  email: string
  password: string
}

export function saveCreds(creds: ClientCreds) {
  try {
    sessionStorage.setItem(CREDS_KEY, JSON.stringify(creds))
  } catch {
    /* ignore */
  }
}

export function loadCreds(): ClientCreds | null {
  try {
    const raw = sessionStorage.getItem(CREDS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ClientCreds
    return parsed && parsed.email && parsed.password ? parsed : null
  } catch {
    return null
  }
}

export function clearCreds() {
  try {
    sessionStorage.removeItem(CREDS_KEY)
  } catch {
    /* ignore */
  }
}

export interface BotStatus {
  ok: boolean
  connected: boolean
  page_name?: string
  bot_name?: string
  message: string
}

/**
 * Logs in with the funnel credentials and asks the backend whether a
 * Facebook page is connected for this account.
 */
export async function checkBotConnection(creds: ClientCreds): Promise<BotStatus> {
  try {
    const loginRes = await fetch(`${SITE.apiUrl}/api/client/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: creds.email, password: creds.password }),
    })
    if (!loginRes.ok) {
      return {
        ok: true,
        connected: false,
        message:
          loginRes.status === 401
            ? "Could not log in with these credentials. If you changed your password in the dashboard, log in there first."
            : `Login failed (${loginRes.status}). Please try again.`,
      }
    }
    const login = await loginRes.json()
    const pagesRes = await fetch(`${SITE.apiUrl}/api/client/pages`, {
      headers: { Authorization: `Bearer ${login.access_token}` },
    })
    if (!pagesRes.ok) return { ok: true, connected: false, message: "Could not check your pages. Please try again." }
    const pages = (await pagesRes.json()).pages as { page_name: string; bot_name: string }[]
    if (pages && pages.length > 0) {
      return {
        ok: true,
        connected: true,
        page_name: pages[0].page_name,
        bot_name: pages[0].bot_name,
        message: `Your bot is connected to "${pages[0].page_name}" and running.`,
      }
    }
    return {
      ok: true,
      connected: false,
      message: "No page is connected yet for this account. Go to your dashboard and connect your Facebook page.",
    }
  } catch {
    return { ok: false, connected: false, message: "Could not reach the server. Please try again in a moment." }
  }
}

export interface ConnectResult {
  ok: boolean
  page_name?: string
  verify_token?: string | null
  message: string
}

/**
 * Logs in with the funnel credentials and connects the user's Facebook page
 * to their account server-side — no dashboard work needed. The client
 * dashboard will already show the page connected when the user logs in.
 */
export async function connectFunnelPage(
  creds: ClientCreds,
  pageAccessToken: string,
  fbAppId?: string,
  fbAppSecret?: string,
): Promise<ConnectResult> {
  try {
    const loginRes = await fetch(`${SITE.apiUrl}/api/client/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: creds.email, password: creds.password }),
    })
    if (!loginRes.ok) {
      return {
        ok: false,
        message:
          loginRes.status === 401
            ? "Could not log in with these credentials. Please re-register from the start."
            : `Login failed (${loginRes.status}). Please try again.`,
      }
    }
    const login = await loginRes.json()
    const res = await fetch(`${SITE.apiUrl}/api/client/pages/connect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${login.access_token}`,
      },
      body: JSON.stringify({
        page_access_token: pageAccessToken,
        fb_app_id: fbAppId || undefined,
        fb_app_secret: fbAppSecret || undefined,
      }),
    })
    const text = await res.text()
    let json: unknown = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    if (!res.ok) {
      const detail =
        json && typeof json === "object" && "detail" in json
          ? String((json as { detail: unknown }).detail)
          : null
      return { ok: false, message: detail || `Connection failed (${res.status}).` }
    }
    const d = json as { status: string; page_name: string; verify_token: string | null }
    return {
      ok: true,
      page_name: d.page_name,
      verify_token: d.verify_token ?? null,
      message: `Page "${d.page_name}" is now connected to your account.`,
    }
  } catch {
    return { ok: false, message: "Could not reach the server. Please try again in a moment." }
  }
}
