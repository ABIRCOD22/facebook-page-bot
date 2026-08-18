export default async () => {
  try {
    const r = await fetch("https://facebook-page-bot-rdkt.onrender.com/health", { signal: AbortSignal.timeout(20000) })
    return { statusCode: 200, body: JSON.stringify({ ok: r.ok, status: r.status }) }
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: String(e) }) }
  }
}

export const config = { schedule: "*/5 * * * *" }