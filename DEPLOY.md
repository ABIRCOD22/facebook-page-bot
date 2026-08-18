# Deploy ChatriX (free, no credit card)

Target: backend on Hugging Face Spaces (free Docker), both frontends on Netlify
(free), Redis on Upstash (free), and a Cloudflare Worker (free) to keep the
backend awake. Nothing here requires a credit card.

## Reality check
- With **no card**, no host is truly "always-on". HF Spaces sleeps ~15 min after
  the last request; the Cloudflare Worker below pings `/health` every 2 min to
  keep it alive in practice.
- Truly always-on free options need a card (**Oracle Always-Free**) or a rewrite
  to **serverless** (Cloudflare Workers / Supabase Edge + Upstash). That is a
  larger change — say the word if you want it.

## 1. Redis — Upstash (no card)
- https://upstash.com → create a Redis database (free 256MB).
- Copy the `rediss://:...@...upstash.io:6379` URL → `REDIS_URL`.

## 2. Backend — Hugging Face Spaces (no card)
- New Space → Docker SDK, **Public**, `app_port: 7860`.
- Upload `backend/` contents (or link the repo). The included `Dockerfile`
  listens on `$PORT` (HF sets 7860).
- In Space **Settings → Secrets**, set every var from `backend/.env.example`.
  Generate secrets: `openssl rand -hex 32` for `JWT_SECRET_KEY` and
  `ADMIN_JWT_SECRET_KEY`.
- First boot runs `init_db()` and creates the super-admin from `ADMIN_EMAIL`/
  `ADMIN_PASSWORD`. Visiting the Space URL confirms `/health` is up.

## 3. Frontends — Netlify (no card) ×2
For **both** `frontend/admin-panel` and `frontend/client-panel`:
- New site from Git → pick the repo, set **Base directory** to the subfolder
  (`frontend/admin-panel`, `frontend/client-panel`). The `netlify.toml` provides
  the rest.
- Set env var in Site settings → Environment:
  - admin-panel: `NEXT_PUBLIC_ADMIN_API_URL` = `https://your-space.hf.space`
  - client-panel: `NEXT_PUBLIC_API_URL` = `https://your-space.hf.space`
- Deploy. Update backend `ALLOWED_ORIGINS` to the two `.netlify.app` domains.

## 4. Keepalive — Cloudflare Worker (no card)
- Free CF account → create Worker, paste `tools/keepalive-worker.js`.
- Edit `tools/wrangler.toml` `BACKEND_URL` to your Space URL, then
  `npx wrangler deploy` (or paste inline in the CF dashboard).
- Cron `*/2 * * * *` hits `/health` so the Space stays warm.

## 5. Verify
- `https://<space>/health` → `{"status":"ok",...}`
- Admin login at `https://admin-panel.netlify.app` with `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- Confirm a Facebook page webhook `GET` verification succeeds.

## Files added for deploy
- `backend/Dockerfile`, `backend/.dockerignore`, `backend/.env.example`
- `frontend/admin-panel/netlify.toml`, `frontend/client-panel/netlify.toml`
- `tools/keepalive-worker.js`, `tools/wrangler.toml`
