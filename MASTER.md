# MASTER.md — ChatriX: Facebook Page Auto-Reply Bot

Context doc for humans and AIs. Read this first. It tells you what this project
is, how far it is, and what still needs verifying. Keep it updated as the
project moves.

## 1. What this project is (the goal)

A **SaaS product**: an AI auto-reply bot that attaches to a Facebook Page and
answers messenger/comment messages automatically.

The funnel:

1. **Funnel website** (marketing + onboarding) — user registers, checks out
   (pricing), runs a setup wizard that connects their Facebook Page, gets a
   webhook verify token, and lands on a welcome page with their credentials.
2. **Client dashboard** — the user logs in, sees their connected page, message
   history, knowledge base, products, subscription.
3. **Admin panel** — the owner (Abir) has full oversight: users, bots,
   conversations, analytics, revenue, subscriptions, system settings, KB
   templates.
4. **Backend** — FastAPI. Auth (user + admin), webhook endpoint that receives
   Facebook page events, bot reply logic, knowledge base management.

Plan was originally staged in 3 phases (planning txt files were deleted —
superseded by this doc): Phase 1 = bot + backend core, Phase 2 = user
dashboard, Phase 3 = super admin. All three are built.

## 2. Repo layout

```
backend/          FastAPI app (the whole API: client + admin + webhook)
frontend/
  website/        Funnel site: landing, pricing, setup wizard (Next.js)
  client-panel/   User dashboard (Next.js)
  admin-panel/    Super admin panel (Next.js)
design-system/    Design tokens + MASTER.md for the visual language
tools/            keepalive-worker.js (Cloudflare Worker pinging /health)
AGENTS.md         dev-mode instructions for AI agents
DEPLOY.md         original deployment guide (HF Spaces era — partially stale)
PRIVACY_POLICY.txt
```

## 3. How far we are (status)

Backend: built. 19 routers registered (client auth/bot/products/knowledge/
subscription/pages/conversations + admin auth/overview/users/subscriptions/
bots/conversations/analytics/revenue/kb_templates/system + webhook).

Frontends: built, deployed, live:

| App | URL | Notes |
|---|---|---|
| Backend | https://facebook-page-bot-rdkt.onrender.com | Render; `py_compile` clean |
| Funnel website | https://fb-autoreply-website.netlify.app | latest deploy live |
| Client dashboard | https://fb-autoreply-client.netlify.app | |
| Admin panel | https://fb-autoreply-admin.netlify.app | |

Demo account (seeded): `demo@chatrix.dev` / `ChatrixDemo2026!`

Key features shipped (most recent work):

- Setup wizard rebuilt on design-system classes with checkbox-gated steps,
  stepper, skip-to-check, mock browser windows per step (`f4e307f`).
- **Auto-connect**: wizard step 3 logs into the backend with the funnel
  account, posts `page_access_token` + `fb_app_id` + `fb_app_secret` to
  `POST /api/client/pages/connect`, which saves the page server-side and
  returns the real webhook **verify token** (`108efa7`).
- **Real bot-liveness check**: backend stamps `webhook_verified_at` when Meta
  verifies the callback URL; list endpoint also exposes `last_bot_reply_at`
  (latest bot message per page). Wizard's final "Check if my bot is alive"
  step shows a 3-signal checklist: page connected / webhook verified by Meta /
  bot actually replied (`852d137`).
- Local cleanup + this doc (`928263d`).

## 4. What needs to be verified (open items)

Still unverified against the REAL Facebook platform — never actually tested:

- [ ] **Redeploy the backend on Render** — the latest connect/liveness
      endpoints (`webhook_verified_at`, `last_bot_reply_at`) are NOT live yet
      for the deployed backend; the live site's liveness check will fail until
      then.
- [ ] A real Facebook App + Page + `page_access_token` end-to-end: connect,
      Meta GET verification of `https://facebook-page-bot-rdkt.onrender.com/api/webhook`,
      a real comment/message triggering an actual bot reply.
- [ ] Confirm the verify token shown in the wizard actually works in
      Meta's webhook callback setup.
- [ ] Knowledge-base / product / subscription flows still only tested against
      the seeded demo data, not a real paying user flow.
- [ ] `tools/` keepalive worker — `wrangler.toml` still points at a
      placeholder URL; not deployed against the Render backend.
- [ ] DEPLOY.md is stale (HF Spaces instructions); actual host is Render.

## 5. Key technical facts

- Backend: FastAPI + SQLAlchemy (models in `backend/models/database_models.py`),
  database init + idempotent ALTERs in `backend/database/connection.py`.
- Webhook: `backend/api/routes/webhook.py` — GET = Meta callback URL
  verification (stamps `webhook_verified_at`), POST = page events.
- Pages connect: `backend/api/routes/client_pages.py` —
  `POST /api/client/pages/connect` returns `verify_token`; list endpoint
  returns liveness fields.
- Funnel wizard: `frontend/website/src/app/setup/page.tsx`;
  API helpers in `frontend/website/src/lib/api.ts`
  (`registerClientUser`, `connectFunnelPage`, `checkBotConnection`, creds in
  sessionStorage as `chatrix_creds`).
- Design system: purple `#7C3AED` / cyan `#0891B2`; classes `.mock`,
  `.tokenfield`, `.field*`, `.chatui/.crow/.bub`, `.checklist`, `.notice`,
  `.btn`, `.card-feature`, `.auth-card`, `.stack-*`, `.row-sm`. Details in
  `design-system/ai-bot-dashboard/MASTER.md`.
- Live URLs baked at build time into the Next.js bundles: `NEXT_PUBLIC_API_URL`
  (backend), `NEXT_PUBLIC_CLIENT_PANEL_URL`, `NEXT_PUBLIC_SITE_URL`. Build
  with these env vars set or `localhost:8000` leaks into the deployed bundle.
- Repo: `ABIRCOD22/facebook-page-bot`, branch master. LF→CRLF warnings on
  commit are normal.
- Backend local run: `backend/run_local.bat` (or uvicorn). `.venv` at repo
  root; `.env` holds local secrets (gitignored).

## 6. How to deploy (verified working path)

Website (from `frontend/website`):
```powershell
$env:NEXT_PUBLIC_API_URL="https://facebook-page-bot-rdkt.onrender.com"
$env:NEXT_PUBLIC_CLIENT_PANEL_URL="https://fb-autoreply-client.netlify.app"
$env:NEXT_PUBLIC_SITE_URL="https://fb-autoreply-website.netlify.app"
npm run build
npx netlify deploy --prod --dir out   # deploys the local build, --no-build style
```
Backend: push to the Render repo → auto-redeploy (or manual deploy from the
Render dashboard).

## 7. Committing good practice

The user wants: no half-baked components, perfection over speed, and
everything verified live before a "done". Commit early and often, keep the
wizard/UX consistent with the design system, never write `localhost` URLs
into deployed bundles.