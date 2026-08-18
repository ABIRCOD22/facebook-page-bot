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
