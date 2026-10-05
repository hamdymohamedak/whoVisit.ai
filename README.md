# WhoVisit

**Analytics for the AI search era.**

WhoVisit is a lightweight traffic intelligence layer that classifies visitors by source — traditional search, AI recommendations (ChatGPT, Perplexity, Gemini, Claude, …), social, referral, paid, direct/unknown — and separates **human AI traffic** from **AI crawlers** (GPTBot, ClaudeBot, and others).

You add it to your existing backend with a single import, configure everything in one JSON file, and load a one-line script on your frontend.

---

## Table of contents

- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Install WhoVisit (build once)](#install-whovisit-build-once)
- [Add WhoVisit to your backend](#add-whovisit-to-your-backend)
- [Connect your frontend](#connect-your-frontend)
- [Configuration (`settings.json`)](#configuration-settingsjson)
- [Browser SDK (`window.WhoVisit`)](#browser-sdk-windowwhovisit)
- [HTTP API](#http-api)
- [Dashboard](#dashboard)
- [What gets classified](#what-gets-classified)
- [Notifications (Discord / Telegram)](#notifications-discord--telegram)
- [Attribution links](#attribution-links)
- [Local demo](#local-demo)
- [Production checklist](#production-checklist)
- [Project layout](#project-layout)
- [License](#license)

---

## How it works

```
┌─────────────────────┐         ┌──────────────────────────────────┐
│  Your frontend      │         │  Your backend (Express, etc.)    │
│  (any stack)        │         │                                  │
│                     │  load   │  app.use(...)                    │
│  <script src=       │ ──────► │  await attachWhoVisit(app)       │
│   "https://api…/    │         │         │                        │
│    whovisit/        │         │         ▼                        │
│    embed.js">       │         │  /whovisit/*  (WhoVisit module)  │
│                     │  events │         │                        │
│  WhoVisit.track()   │ ──────► │  classify → store → notify       │
└─────────────────────┘         └──────────────────────────────────┘
```

| Piece | Responsibility |
|-------|----------------|
| **`whoVisit/settings.json`** (on your backend) | Site ID, API key, Discord/Telegram, filters, database path, public backend URL |
| **`attachWhoVisit(app)`** | Mounts WhoVisit under `/whovisit` without changing your other routes |
| **`embed.js`** | Served by the backend; injects config and loads the SDK |
| **Frontend script tag** | Must use the **full backend URL** when frontend and API are on different origins |

WhoVisit does **not** replace your application logic. It only mounts under a path prefix (default `/whovisit`) and stays isolated.

---

## Requirements

- **Node.js** 20+ (22+ recommended)
- **pnpm** (or npm/yarn) to build this repository
- An **Express**-compatible app for the embed helper (or use the standalone API server)
- A publicly reachable **backend origin** (HTTPS in production) so the browser can load `embed.js` and post events

---

## Install WhoVisit (build once)

Clone and build this repository on a machine that can reach your backend deploy (or build in CI):

```bash
git clone https://github.com/YOUR_ORG/whovisit.git
cd whovisit
pnpm install
pnpm run build
```

You need a successful build so `packages/api/dist` and `packages/sdk/dist` exist. Your backend will load those artifacts via `whoVisitRoot` (path to this clone).

---

## Add WhoVisit to your backend

You create the `whoVisit` folder **yourself** inside **your** backend project. Do not treat the WhoVisit monorepo as your app.

### 1. Copy the embed kit

```bash
cp -r /path/to/whovisit/templates/whoVisit /path/to/your-backend/whoVisit
cp /path/to/your-backend/whoVisit/settings.example.json \
   /path/to/your-backend/whoVisit/settings.json
```

### 2. Edit `whoVisit/settings.json`

Set at least:

```json
{
  "backendUrl": "https://api.your-domain.com",
  "mountPath": "/whovisit",
  "site": {
    "id": "my_website",
    "name": "My Website",
    "apiKey": ""
  },
  "notify": {
    "discordWebhook": "https://discord.com/api/webhooks/...",
    "aiOnly": false,
    "minConfidence": "low",
    "conversions": true
  }
}
```

- Leave `apiKey` empty on first start — WhoVisit generates one and writes it back into `settings.json`.
- `backendUrl` must be the **public origin of your backend** (where WhoVisit is mounted), not your SPA origin.

### 3. Attach in `server.js` only

```js
import express from "express";
import { attachWhoVisit } from "./whoVisit/index.js";

const app = express();

// … your existing middleware and routes — unchanged …

await attachWhoVisit(app, {
  // Absolute path to the cloned & built WhoVisit repository
  whoVisitRoot: process.env.WHOVISIT_ROOT || "/absolute/path/to/whovisit",
});

app.listen(3000);
```

Alternatively:

```bash
export WHOVISIT_ROOT=/absolute/path/to/whovisit
```

Then call `await attachWhoVisit(app)`.

### What this does

- Mounts WhoVisit at `{mountPath}` (default `/whovisit`)
- Serves `embed.js`, `v1.js`, events API, analytics, redirects
- Applies Discord / Telegram / filters from `settings.json`
- Does **not** modify or wrap your other routes

---

## Connect your frontend

Your frontend is completely separate. It only needs to load the embed script from the **backend**.

### Correct (separate frontend + API)

```html
<script src="https://api.your-domain.com/whovisit/embed.js" async></script>
```

Use the same host as `backendUrl` in `settings.json`.

### Incorrect when origins differ

```html
<!-- Looks for /whovisit on the frontend host — usually wrong -->
<script src="/whovisit/embed.js"></script>
```

Relative paths only work if the HTML is served by the **same** origin that mounts WhoVisit.

### What `embed.js` does

1. Injects `window.__WHOVISIT_CONFIG__` (site ID, API key, `apiBase`, notify defaults)
2. Loads the SDK from `{backendUrl}{mountPath}/v1.js`
3. Starts automatic `page_view` tracking (unless disabled in settings)

You do **not** put Discord webhooks or site secrets as HTML attributes when using the embed kit — those live in `settings.json` on the server.

### Track conversions and custom events

```html
<script src="https://api.your-domain.com/whovisit/embed.js" async></script>
<script>
  // After embed loads:
  document.getElementById("buy").addEventListener("click", () => {
    WhoVisit.conversion({ revenue: 49 });
  });

  WhoVisit.track("signup", { plan: "pro" });
</script>
```

---

## Configuration (`settings.json`)

All operational settings for the embed kit live in **your** `whoVisit/settings.json`.

| Field | Description |
|-------|-------------|
| `backendUrl` | Public origin of the backend that mounts WhoVisit (e.g. `https://api.example.com`) |
| `mountPath` | URL prefix (default `/whovisit`) |
| `site.id` | Stable site identifier |
| `site.name` | Display name |
| `site.apiKey` | Leave empty once to auto-generate; keep private |
| `notify.discordWebhook` | Discord incoming webhook URL |
| `notify.telegramBotToken` / `telegramChatId` | Telegram bot delivery |
| `notify.aiOnly` | If `true`, only AI-classified page views notify |
| `notify.minConfidence` | `low` \| `medium` \| `high` |
| `notify.conversions` | Notify on conversion events (default `true`) |
| `database.path` | SQLite file path relative to the `whoVisit/` folder |
| `tracking.autoPageView` | Auto-send `page_view` on load (default `true`) |

Change behavior by editing this file and restarting your server — you do not need to know the full monorepo.

---

## Browser SDK (`window.WhoVisit`)

Available after `embed.js` (or a legacy script tag) loads.

| Method | Description |
|--------|-------------|
| `init(options)` | Initialize / reconfigure the client |
| `register(siteId?)` | Create a site + API key (standalone / admin use) |
| `getConfig()` | Read server-side config (requires API key) |
| `configure(patch)` | Update notify + integrations on the server |
| `rotateKey()` | Issue a new API key |
| `track(event, data?)` | Custom event |
| `conversion(data?)` | Conversion event (`revenue` supported) |
| `createLink({ targetUrl, sourcePlatform, label? })` | Create attribution redirect URL |
| `listLinks()` | List attribution links |
| `getSummary()` | Fetch analytics summary JSON |

Authenticated calls send headers:

- `X-WhoVisit-Site`
- `X-WhoVisit-Key`

---

## HTTP API

Mounted under `{mountPath}` (examples assume `/whovisit`).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/whovisit/health` | Health check |
| `GET` | `/whovisit/embed.js` | Frontend loader (config + SDK) |
| `GET` | `/whovisit/v1.js` | Browser SDK |
| `POST` | `/whovisit/v1/events` | Ingest tracking events |
| `GET` | `/whovisit/v1/analytics/:siteId/summary` | Aggregates (sources, AI, funnel, countries) |
| `GET`/`PATCH` | `/whovisit/v1/site/config` | Site config (auth required) |
| `POST` | `/whovisit/v1/site/register` | Register site + key |
| `POST` | `/whovisit/v1/site/rotate-key` | Rotate API key |
| `GET`/`POST` | `/whovisit/v1/site/links` | Attribution links |
| `GET` | `/whovisit/v1/r/:id` | Attribution redirect (+ UTM) |

CORS is open (`*`) for MVP embeds. Restrict origins before exposing a public multi-tenant SaaS.

---

## Dashboard

Optional UI packaged in this monorepo:

```bash
pnpm --filter @whovisit/dashboard dev
```

Open http://localhost:5173 — enter `siteId` and API key, then refresh analytics, funnel, countries, and attribution links.

Proxy to your API if the dashboard is not same-origin with WhoVisit.

---

## What gets classified

Traffic is classified server-side (thin SDK, heavy backend):

| Category | Examples |
|----------|----------|
| **AI (human)** | chatgpt.com, perplexity.ai, gemini, claude, copilot; or `utm_source=chatgpt` / `utm_medium=ai` |
| **AI crawlers** | GPTBot, ClaudeBot, PerplexityBot, Google-Extended, … |
| **Search** | Google, Bing, DuckDuckGo, … (query extracted when present) |
| **Social** | Facebook, X, LinkedIn, Reddit, … |
| **Paid** | `utm_medium=cpc|ppc|paid` |
| **Referral** | Other known referrers |
| **Unknown / estimated** | Empty referrer; optional low-confidence estimated AI |

Each visit can include confidence (`high` / `medium` / `low`), device, browser, OS, and geo (IP-based; local IPs show as private/local in development).

---

## Notifications (Discord / Telegram)

Configured in `settings.json` (or via `WhoVisit.configure` when using an API key).

Typical Discord message includes:

- Event type (`page_view`, `conversion`, …)
- Page path and UTM
- Source category / platform / confidence
- Visitor block: location, IP hint, device, browser, OS, language, timezone
- Revenue on conversions

Filters:

- `notify.aiOnly: true` — AI traffic only  
- `notify.minConfidence: "medium"` — drop low-confidence noise  

---

## Attribution links

Create short links that redirect through WhoVisit and stamp UTM for high-confidence AI attribution:

```js
const { url } = await WhoVisit.createLink({
  targetUrl: "https://yoursite.com/pricing",
  sourcePlatform: "chatgpt",
  label: "pricing-from-gpt",
});
// Share `url` → https://api.your-domain.com/whovisit/v1/r/{id}
```

---

## Local demo

From the WhoVisit repository (after `pnpm run build`):

```bash
# Standalone WhoVisit API on :8787
pnpm run dev:api

# Or Express host demo on :3000 with WhoVisit mounted
WHOVISIT_ROOT=$PWD pnpm run dev:host
```

Then open the printed URL and use:

```html
<script src="http://localhost:3000/whovisit/embed.js" async></script>
```

---

## Production checklist

- [ ] `backendUrl` is your public **API** origin (HTTPS)
- [ ] Frontend script uses that same origin: `https://api…/whovisit/embed.js`
- [ ] `WHOVISIT_ROOT` (or package install) points at a **built** WhoVisit tree
- [ ] Process manager (systemd, pm2, Docker) keeps the host app running
- [ ] Discord/Telegram secrets only in `settings.json` / env — not committed publicly
- [ ] Rotate `apiKey` if it was ever exposed in a public repo
- [ ] Prefer reverse proxy (`X-Forwarded-For`) so geo/IP is accurate
- [ ] Plan migration to PostgreSQL for multi-instance production (SQLite is fine for single-node MVP)

---

## Project layout

```
whovisit/
├── packages/
│   ├── api/          # Classification, storage, embed mount, HTTP API
│   └── sdk/          # Browser SDK (v1.js)
├── apps/
│   └── dashboard/    # Optional analytics UI
├── templates/
│   └── whoVisit/     # ← copy this into YOUR backend as ./whoVisit
├── examples/
│   ├── demo.html     # Legacy script-tag demo
│   └── host-server.js
└── README.md
```

---

## License

Add your preferred license (MIT recommended for open source). Until then, all rights reserved by the repository owner.

---

## Support

- Embed kit details: [`templates/whoVisit/README.md`](./templates/whoVisit/README.md)
- Product plan / roadmap notes: [`plan.md`](./plan.md)

**Positioning:** not a Google Analytics clone — **analytics for the AI search era**: who referred the visit, which AI, which page, whether they converted, and which AI crawlers read your content.
