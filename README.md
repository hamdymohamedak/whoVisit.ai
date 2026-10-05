# WhoVisit

AI Traffic Intelligence — thin SDK + classification API + dashboard.

## Quick start

```bash
npm install
npm run build
npm run dev:api
# optional dashboard
npm run dev -w @whovisit/dashboard
```

## Embed on any site

```html
<script
  src="http://localhost:8787/v1.js"
  data-site="site_your_id"
  data-api="http://localhost:8787"
  data-discord-webhook="https://discord.com/api/webhooks/..."
  data-telegram-bot-token="123456:ABC..."
  data-telegram-chat-id="-1001234567890"
></script>
```

Track conversions:

```js
WhoVisit.conversion({ revenue: 49 });
```

## Attribution links

```bash
curl -X POST http://localhost:8787/v1/links \
  -H 'Content-Type: application/json' \
  -d '{"siteId":"site_demo","targetUrl":"https://example.com/pricing","sourcePlatform":"chatgpt"}'
```

Redirect URL: `http://localhost:8787/v1/r/{id}` (adds UTM for high-confidence AI attribution).

## API

- `POST /v1/events` — SDK event ingestion
- `POST /v1/notify-config` — store Discord/Telegram credentials per site
- `GET /v1/analytics/:siteId/summary` — dashboard aggregates
- `GET /v1/r/:linkId` — attribution redirect
