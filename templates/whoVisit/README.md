# WhoVisit embed kit — copy into YOUR backend

هذا المجلد **مش** جزء من تشغيل مشروع WhoVisit نفسه.
إنت بتنسخه يدويًا داخل مشروع الباك‌اند بتاعك.

## الفكرة

```
Frontend (موقعك)                    Backend (API + WhoVisit)
─────────────────                   ───────────────────────
<script src="https://api…/whovisit/embed.js">
        │
        └──► يحمل الإعدادات من السيرفر
        └──► يرسل الأحداث إلى نفس الـ backendUrl
```

الفرونت **منفصل** — لازم الـ `src` يكون عنوان الـ **باك‌اند الكامل**، مش مسار نسبي على الفرونت.

## 1) انسخ المجلد

```bash
cp -r templates/whoVisit /path/to/your-backend/whoVisit
cp whoVisit/settings.example.json whoVisit/settings.json
```

في `settings.json` حط عنوان الباك‌اند:

```json
{
  "backendUrl": "https://api.your-domain.com",
  "mountPath": "/whovisit"
}
```

## 2) server.js (سطر واحد)

```js
import { attachWhoVisit } from "./whoVisit/index.js";

await attachWhoVisit(app, {
  whoVisitRoot: process.env.WHOVISIT_ROOT, // أو مسار ريبو WhoVisit بعد build
});
```

## 3) الفرونت — عنوان الـ API كامل

```html
<script src="https://api.your-domain.com/whovisit/embed.js" async></script>
```

- `https://api.your-domain.com` = نفس قيمة **`backendUrl`** في `settings.json`
- مفيش `data-site` / Discord في HTML — كله من السيرفر عبر `embed.js`
- `embed.js` يحقن `apiBase` تلقائيًا = `backendUrl + mountPath`

### غلط (فرونت منفصل)

```html
<script src="/whovisit/embed.js"></script>
```

ده يدور على الفرونت نفسه مش الباك‌اند.

## settings.json

| Field | Meaning |
|-------|---------|
| `backendUrl` | أصل الباك‌اند العام (مثال `https://api.mysite.com`) |
| `mountPath` | بادئة WhoVisit (افتراضي `/whovisit`) |
| `site.id` | معرّف الموقع |
| `site.apiKey` | سيبه فاضي مرة — يتولّد ويُكتب تلقائيًا |
| `notify.*` | Discord / Telegram / فلاتر |
| `database.path` | ملف SQLite نسبة لمجلد `whoVisit/` |
