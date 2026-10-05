## قائمة التنفيذ (WhoVisit)

- [x] Monorepo: SDK + API + Dashboard (`packages/sdk`, `packages/api`, `apps/dashboard`)
- [x] SDK بسطر `<script>` — `data-site`, `data-api`, page_view / navigation / conversion
- [x] Discord فوري — `data-discord-webhook` + إشعار على كل `page_view`
- [x] Telegram فوري — `data-telegram-bot-token` + `data-telegram-chat-id`
- [x] `POST /v1/events` — Event pipeline + تخزين
- [x] Rules Engine: UTM → Referrer → Registry → Social/Referral → User-Agent bots
- [x] Confidence: high / medium / low / unknown
- [x] فصل Human vs Bot + AI Crawler (GPTBot, ClaudeBot, …)
- [x] Source registry في DB (تحديث بدون إصدار SDK)
- [x] استخراج search query (Google/Bing/… عند توفرها)
- [x] Session attribution + conversion + revenue
- [x] Attribution links `/v1/r/:id` + UTM تلقائي
- [x] Analytics API + Dashboard (AI sources, crawlers, conversions)
- [ ] PostgreSQL production (حالياً SQLite للتطوير المحلي)
- [ ] IP-derived metadata / country
- [ ] AI Visibility Score (42/81/… — تقديري)
- [ ] Probabilistic AI fingerprinting (Estimated AI Traffic)
- [ ] Source Discovery UI لإضافة domains جديدة
- [ ] Auth multi-tenant + CDN production

---

الفكرة الأساسية: تعمل أداة تحلل مصدر الزيارة الحقيقي وتحاول تصنفه إلى:

زيارة من محرك بحث تقليدي.
زيارة من AI نتيجة Recommendation / Citation.
زيارة Direct.
Referral عادي.
Social.
Paid.
Bot / Crawler.

والأهم إنك تفرق بين:

AI Search → المستخدم بحث داخل ChatGPT أو Gemini أو Perplexity ثم ضغط على موقعك

وبين:

AI Crawler → النموذج نفسه بيزور موقعك لجمع المعلومات.

الشكل المقترح للتول

أسميها مثلاً:

AI Traffic Intelligence

أو:

AIVISOR

أو:

AI Referral Analytics

وتكون عبارة عن SDK صغير تضيفه لموقعك:

<script src="your-tool.com/sdk.js"></script>

وبعدها الأداة تبدأ تجمع بيانات الزيارات.

1. أول حاجة نحدد مصدر الزيارة ✅

عند وصول المستخدم:

https://mysite.com/product

الأداة تجمع:

referrer
landing URL
UTM parameters
user agent
timestamp
IP-derived metadata
session ID
previous page
navigation path

مثلاً:

Referer:
https://www.google.com/search?q=best+hr+software

يبقى:

SEARCH

لكن لو:

Referer:
https://chatgpt.com/...

يبقى غالباً:

AI

ونفس الفكرة:

perplexity.ai
claude.ai
gemini.google.com
copilot.microsoft.com

إلخ.

2. لكن هنا توجد المشكلة المهمة

لو المستخدم دخل من AI:

ChatGPT
   ↓
Your Website

ممكن الـ browser لا يرسل لك Referer واضح.

وفي بعض الحالات قد يصل:

Referer: ""

وبالتالي لو اعتمدت على:

document.referrer

فقط، هتخسر نسبة من الزيارات.

لذلك لازم تعمل Multi-Signal Classification.

3. UTM Attribution ✅

دي من أقوى الطرق.

لو AI platform عملت link بالشكل:

https://example.com/product
?utm_source=chatgpt
&utm_medium=ai

تقدر تصنف مباشرة:

source = chatgpt
medium = ai

وتخزن:

{
  "source": "chatgpt",
  "medium": "ai",
  "confidence": 1
}

لكن طبعاً مش كل AI platforms هتضيف UTM.

4. Referrer Intelligence ✅

تعمل Database لمصادر الزيارات.

مثلاً:

AI

chatgpt.com
chat.openai.com
perplexity.ai
gemini.google.com
claude.ai
copilot.microsoft.com
you.com
phind.com

Search:

google.com
bing.com
yahoo.com
duckduckgo.com
yandex.com
baidu.com

Social:

facebook.com
instagram.com
linkedin.com
x.com
reddit.com

وبالتالي:

referrer
   ↓
normalize
   ↓
domain extraction
   ↓
source database
   ↓
classification
5. Search Traffic Detection ✅ (جزئي — query عندما لا يخفيه المحرك)

وهنا نقدر نطلع حاجة أقوى من مجرد:

Google = Search

لو الـ referrer يحتوي على:

google.com/search?q=...

تقدر تستخرج:

search engine = Google
query = ...

مثلاً:

Google
query:
best payroll software for small business

فتقدر تعمل:

Search Traffic

Google
    ├── query
    ├── landing page
    ├── country
    ├── device
    └── conversion

لكن مهم جداً: Google غالباً يخفي query في كثير من الحالات، لذلك لا تعتمد على وجود query دائماً.

6. AI Traffic Detection ✅

نفس الفكرة.

مثلاً:

ChatGPT
    ↓
https://mysite.com

تسجل:

{
  "source": "chatgpt",
  "type": "ai",
  "subtype": "ai_recommendation"
}

لكن هنا نقدر نعمل مستوى أعمق.

7. AI Source Attribution ✅

بدل ما تقول:

AI = 1,238 visitors

تقول:

AI Traffic

ChatGPT       621
Perplexity    382
Gemini        151
Claude         61
Copilot        23

وبعدين:

AI → Website

وتقدر تعرف:

AI source
↓
landing page
↓
pages viewed
↓
session duration
↓
conversion
↓
revenue

وده يبدأ يتحول إلى منتج قوي فعلاً.

8. والأهم: AI Recommendation Attribution ✅ (جلسة + landing + conversion)

هنا بقى الجزء المميز.

مثلاً عندك:

ChatGPT

وأرسل المستخدم إلى:

https://example.com/pricing

أنت لا تعرف بالضرورة:

هل ChatGPT ذكر موقعك كـ recommendation؟

ممكن تعمل attribution probabilistic.

مثلاً:

AI Traffic Detected
        ↓
Referrer = ChatGPT
        ↓
Landing page = /pricing
        ↓
New session
        ↓
Conversion

فتسجل:

AI-attributed session

مع:

confidence: high
9. Confidence System ✅

مهم جداً ألا تقول للعميل:

هذه الزيارة جاءت من ChatGPT

إذا أنت غير متأكد.

اعمل:

HIGH
MEDIUM
LOW
UNKNOWN

مثلاً:

High
utm_source=chatgpt
utm_medium=ai

أو referrer واضح:

chatgpt.com
Medium

مثلاً:

referrer غير موجود
لكن
session behavior + campaign parameters
Low

استنتاج مبني على signals غير مباشرة.

10. Direct Traffic ⚠️ (Unknown منفصل؛ Direct صريح يحتاج إشارة إضافية)

لازم تفصل:

Direct

عن:

Unknown

لأن:

referrer = ""

لا يعني بالضرورة أن المستخدم كتب URL بنفسه.

ممكن يكون:

privacy stripping
browser policy
AI app
email
messaging app
mobile app

لذلك الأفضل:

DIRECT
UNKNOWN

كفئتين منفصلتين.

11. والأهم: لا تعتمد على User-Agent فقط ✅ (UA للـ crawlers فقط)

ممكن تعمل:

Mozilla/5.0

وتقول:

AI

لكن ده غير صحيح.

User-Agent مهم أكثر في اكتشاف:

AI Crawlers

وليس بالضرورة:

AI Human Referral

مثلاً crawler قد يكون:

GPTBot
ClaudeBot
PerplexityBot
Google-Extended

وهذه زيارة مختلفة تماماً.

12. افصل Human AI Traffic عن AI Crawlers ✅

ودي نقطة أساسية جداً في المنتج.

اعمل:

TRAFFIC
│
├── HUMAN
│   │
│   ├── SEARCH
│   ├── AI
│   ├── SOCIAL
│   ├── REFERRAL
│   └── DIRECT
│
└── BOT
    │
    ├── AI CRAWLER
    ├── SEARCH CRAWLER
    └── OTHER BOT

فتقدر تقول للعميل:

AI Discovery

Human AI Visits       1,842
AI Crawlers           7,421

وده أقوى بكثير من Google Analytics التقليدي.

13. AI Crawler Intelligence ✅

هنا ممكن تضيف feature قوية جداً.

لما:

GPTBot
ClaudeBot
PerplexityBot

يزور الموقع، تسجل:

crawler
timestamp
URL
status
response time
content type

مثلاً:

AI Crawlers

GPTBot
├── /pricing
├── /features
├── /docs
└── /about

PerplexityBot
├── /pricing
└── /blog/article-1

ClaudeBot
└── /docs

فتعرف:

ما هي الصفحات التي تقوم نماذج الذكاء الاصطناعي بقراءتها؟

14. وبعدها تعمل AI Visibility Score ❌ (لم يُنفَّذ)

وهنا الأداة تبدأ تتقاطع مع أداة GEO اللي كنا بنتكلم عنها.

مثلاً:

AI Visibility
78/100

والـ breakdown:

AI Traffic             42
AI Crawler Coverage    81
AI Citations           67
AI Recommendations     73
Content Coverage       84

لكن لا تخلط بين ما يمكن قياسه مباشرة وما هو تقديري.

مثلاً:

AI Traffic

يمكن قياسه.

لكن:

How many times ChatGPT recommended you

غالباً يحتاج بيانات خارجية أو testing خاص.

15. Dashboard ✅

أنا شايف Dashboard بالشكل ده:

AI Traffic Intelligence
────────────────────────────────

Visitors

Total             48,291

Search            28,421
AI                 4,821
Direct             7,231
Social             3,128
Referral           4,112
Unknown              578

ثم:

AI Sources
────────────────────────

ChatGPT             2,184
Perplexity          1,321
Gemini                721
Claude                421
Copilot               174
Other                  20

ثم:

AI → Pages

/pricing             1,421
/features              821
/blog/...              712
/docs/...              521
/home                  411
16. Conversion Attribution ✅

ودي بالنسبة لي أهم feature تجارية.

مثلاً:

Traffic Source      Visitors     Signups    Revenue
────────────────────────────────────────────────────

Google                28,421       821       $21,420

ChatGPT                2,184       241       $12,820

Perplexity             1,321       121        $6,420

Gemini                   721        41        $1,920

هنا العميل ممكن يكتشف:

AI traffic أقل من Google، لكن conversion rate أعلى بكثير.

وده يخلي المنتج business intelligence tool وليس مجرد analytics counter.

17. Session Attribution ✅

ممكن تعمل:

Session ID

AI
 ↓
Landing
 ↓
Pricing
 ↓
Signup
 ↓
Purchase

وتخزن:

{
  "sessionId": "sess_123",
  "source": {
    "type": "ai",
    "platform": "chatgpt",
    "confidence": "high"
  },
  "landingPage": "/pricing",
  "conversion": true,
  "revenue": 49
}
18. أهم نقطة تقنية ✅

أنا مش أنصح أنك تعمل كل شيء داخل JavaScript SDK.

اعمل Architecture بالشكل ده:

Website
   │
   │ SDK
   ▼
Collection API
   │
   ▼
Event Pipeline
   │
   ├── Source Detection
   ├── Bot Detection
   ├── AI Detection
   ├── Search Detection
   ├── Session Attribution
   └── Confidence Engine
          │
          ▼
       Database
          │
          ▼
       Analytics API
          │
          ▼
       Dashboard
19. الـ SDK يكون صغير جداً ✅

مثلاً:

<script
  src="https://cdn.yourtool.com/v1.js"
  data-site="site_xxx">
</script>

ويعمل:

page_view
session_start
navigation
conversion

ويضيف attribution.

20. اعمل Event Model من البداية ✅

مثلاً:

{
  "event": "page_view",

  "siteId": "site_123",

  "sessionId": "sess_456",

  "page": {
    "url": "...",
    "path": "/pricing"
  },

  "source": {
    "category": "ai",
    "platform": "chatgpt",
    "confidence": 0.98
  },

  "device": {
    "type": "desktop",
    "browser": "Chrome"
  },

  "timestamp": "..."
}
21. Source Classification Engine ✅

اعملها كـ Rules Engine في البداية.

مثلاً:

UTM
 ↓
Referrer
 ↓
Known AI domains
 ↓
Known Search domains
 ↓
Social domains
 ↓
User-Agent
 ↓
Bot signatures
 ↓
Unknown

وبعدين ممكن تخليها أكثر ذكاءً.

22. Database ✅ (SQLite dev — جداول sites, sessions, events, bots/crawlers, links)

مثلاً PostgreSQL:

sites
sessions
events
sources
page_views
conversions
bots
ai_crawlers

والـ session مثلاً:

sessions

id
site_id
source_type
source_platform
confidence
landing_page
country
device
started_at
23. Feature مهمة جداً: Source Discovery ✅ (registry في DB؛ واجهة إدارة ❌)

ما تعملش قائمة ثابتة داخل الكود فقط.

اعمل:

source_registry

مثلاً:

{
  "domain": "chatgpt.com",
  "category": "ai",
  "platform": "chatgpt"
}

وتقدر تحدثها بدون إصدار SDK جديد.

مثلاً:

your API
   ↓
source registry
   ↓
SDK

أو الأفضل أن جزء classification يكون server-side.

24. والأذكى: Attribution Link ✅

ممكن تضيف نظام اختياري:

https://yourtool.com/r/abc123

ثم redirect:

AI
 ↓
yourtool redirect
 ↓
customer website

فتقدر تعمل attribution أقوى.

لكن ده يعتمد على كون الرابط الذي يشاركه الموقع هو الرابط الذي يمر عبر خدمتك، وده مش هيحل الزيارات العضوية العامة تلقائياً.

25. ممكن كمان تعمل AI Referral Fingerprinting ❌

لو المستخدم وصل بدون referrer:

No Referrer

لكن عندك:

AI-specific URL parameters
browser behavior
session timing
navigation pattern
known redirect signatures

ممكن تعمل:

probable_ai

لكن تعرضها كـ:

Estimated AI Traffic

وليس:

Confirmed AI Traffic

ودي نقطة مهمة جداً للمصداقية.

المنتج النهائي ممكن يبقى أقوى من مجرد "مين جاب الزيارة"

أنت فعلياً ممكن تعمل:

                    ┌── Google
                    ├── Bing
                    ├── DuckDuckGo
                    │
Visitor ──► SOURCE ├── ChatGPT
                    ├── Gemini
                    ├── Claude
                    ├── Perplexity
                    │
                    ├── Social
                    ├── Referral
                    ├── Direct
                    └── Unknown
                           │
                           ▼
                    Attribution Engine
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
           Pages       Conversion     Revenue
              │            │            │
              └────────────┼────────────┘
                           ▼
                    AI Visibility

والميزة الأقوى في رأيي إنك ما تعملهاش كـ "Google Analytics بديل".

خلي الـ positioning:

Analytics for the AI Search Era

يعني الأداة تجيب إجابة على:

مين جاب المستخدم؟

هل جاء من Google أم من AI؟

أي AI؟

أي صفحة رشحها الـ AI؟

هل المستخدم اشترى؟

أي AI مصدره أفضل من ناحية conversion؟

وأي صفحات موقعك تحصل على اهتمام من AI crawlers؟

بالنسبة له الموضوع فعلاً:

<script
  src="https://cdn.yourtool.com/sdk.js"
  data-site="site_xxx">
</script>

فقط.

لكن خلف الكواليس:

SDK
 ↓
POST /events
 ↓
Your API
 ↓
Classification
 ↓
Database
ممكن تخلي الـ SDK ذكي جزئياً

وده الحل اللي أفضلّه.

الـ SDK يعمل الأشياء التي لا تحتاج Backend:

referrer
URL
UTM
session
page views
navigation
conversion
browser/device information

ثم يرسلها.

والـ Backend يعمل:

AI classification
Search classification
Bot classification
Source normalization
Confidence scoring
Attribution
Aggregation
Analytics

يعني:

Thin SDK + Heavy Backend

وده أنسب Architecture للمنتج ده.

والأهم بالنسبة لفكرتك

لو أنت عايز الأداة تكون package عالمية، لا تربطها بـ React أو Next أو Vue أصلاً.

خلي المنتج الأساسي:

<script src="..."></script>

وبالتالي أي موقع تقريباً يستطيع استخدامها.

حتى:

React
Next.js
Vue
Nuxt
Svelte
Angular
Astro
WordPress
PHP
Laravel
Django
Rails
Vanilla HTML

كلهم يقدروا يستخدموا نفس الـ SDK.

فالـ Front-end integration = سطر واحد.

لكن المنتج نفسه = SaaS Full-stack.

وده في رأيي أفضل بكثير من محاولة بناء الأداة كلها داخل الـ Front-end.

و عايز ال 
<script src="..."></script>
يبقي بيدعم attribute discord bot url , telegram bot url بحيث الزيارات تروح لصاحب الموقع علي البوت بتاعه علي طول ✅

```html
<script
  src="http://localhost:8787/v1.js"
  data-site="site_your_id"
  data-api="http://localhost:8787"
  data-discord-webhook="https://discord.com/api/webhooks/..."
  data-telegram-bot-token="BOT_TOKEN"
  data-telegram-chat-id="CHAT_ID"
></script>
```

**تشغيل محلي:** `npm install` → `npm run build` → `npm run dev:api` → Dashboard: `npm run dev -w @whovisit/dashboard`