import { Hono } from "hono";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { UAParser } from "ua-parser-js";
import { z } from "zod";
import { classifyVisit } from "../classification/source-registry.js";
import { db } from "../db/index.js";
import { ensureSite, seedSourceRegistry } from "../db/seed.js";
import { events, sessions, sites, sourceRegistry } from "../db/schema.js";
import { sendDiscordWebhook, sendTelegram } from "../services/notify.js";

const eventSchema = z.object({
  event: z.string(),
  siteId: z.string(),
  sessionId: z.string(),
  timestamp: z.string(),
  page: z.object({
    url: z.string(),
    path: z.string(),
    title: z.string().optional(),
  }),
  referrer: z.string().optional().default(""),
  utm: z.record(z.string()).optional().default({}),
  device: z.record(z.string()).optional(),
  revenue: z.number().optional(),
  value: z.number().optional(),
});

function loadRegistry(): Record<string, { category: "ai" | "search" | "social" | "referral" | "direct" | "unknown" | "paid"; platform: string }> {
  const rows = db.select().from(sourceRegistry).all();
  const out: Record<string, { category: "ai" | "search" | "social" | "referral" | "direct" | "unknown" | "paid"; platform: string }> = {};
  for (const r of rows) {
    out[r.domain] = { category: r.category as "ai" | "search" | "social" | "referral" | "direct" | "unknown" | "paid", platform: r.platform };
  }
  return out;
}

export const eventsRoute = new Hono();

eventsRoute.post("/events", async (c) => {
  seedSourceRegistry();
  const body = await c.req.json();
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;
  ensureSite(data.siteId);

  const userAgent = c.req.header("user-agent") || "";
  const classification = classifyVisit({
    referrer: data.referrer,
    utm: data.utm,
    userAgent,
    registry: loadRegistry(),
  });

  const parser = new UAParser(userAgent);
  const deviceType = parser.getDevice().type || "desktop";

  const eventId = nanoid();
  db.insert(events)
    .values({
      id: eventId,
      siteId: data.siteId,
      sessionId: data.sessionId,
      eventType: data.event,
      pagePath: data.page.path,
      pageUrl: data.page.url,
      referrer: data.referrer,
      userAgent,
      rawUtm: JSON.stringify(data.utm),
      trafficKind: classification.trafficKind,
      sourceCategory: classification.sourceCategory,
      sourcePlatform: classification.sourcePlatform,
      confidence: classification.confidence,
      searchQuery: classification.searchQuery,
      isBot: classification.trafficKind === "bot",
      botName: classification.botName,
      payload: JSON.stringify(data),
      createdAt: data.timestamp,
    })
    .run();

  const existingSession = db
    .select()
    .from(sessions)
    .where(eq(sessions.id, data.sessionId))
    .get();

  const isConversion = data.event === "conversion";
  const revenue = data.revenue ?? data.value ?? 0;

  if (!existingSession) {
    db.insert(sessions)
      .values({
        id: data.sessionId,
        siteId: data.siteId,
        trafficKind: classification.trafficKind,
        sourceCategory: classification.sourceCategory,
        sourcePlatform: classification.sourcePlatform,
        confidence: classification.confidence,
        landingPage: data.page.path,
        deviceType,
        converted: isConversion,
        revenue: isConversion ? revenue : 0,
        startedAt: data.timestamp,
      })
      .run();
  } else if (isConversion) {
    db.update(sessions)
      .set({
        converted: true,
        revenue: (existingSession.revenue ?? 0) + revenue,
      })
      .where(eq(sessions.id, data.sessionId))
      .run();
  }

  const site = db.select().from(sites).where(eq(sites.id, data.siteId)).get();
  if (site && (data.event === "page_view" || data.event === "session_start")) {
    const notification = {
      siteId: data.siteId,
      eventType: data.event,
      pagePath: data.page.path,
      classification,
      referrer: data.referrer,
    };
    if (site.discordWebhook) {
      sendDiscordWebhook(site.discordWebhook, notification).catch(() => {});
    }
    if (site.telegramBotToken && site.telegramChatId) {
      sendTelegram(site.telegramBotToken, site.telegramChatId, notification).catch(
        () => {}
      );
    }
  }

  return c.json({
    ok: true,
    eventId,
    source: {
      category: classification.sourceCategory,
      platform: classification.sourcePlatform,
      confidence: classification.confidence,
      trafficKind: classification.trafficKind,
    },
  });
});

const notifyConfigSchema = z.object({
  siteId: z.string(),
  discordWebhook: z.string().url().optional(),
  telegramBotToken: z.string().optional(),
  telegramChatId: z.string().optional(),
});

eventsRoute.post("/notify-config", async (c) => {
  const body = await c.req.json();
  const parsed = notifyConfigSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  ensureSite(parsed.data.siteId);
  db.update(sites)
    .set({
      discordWebhook: parsed.data.discordWebhook ?? null,
      telegramBotToken: parsed.data.telegramBotToken ?? null,
      telegramChatId: parsed.data.telegramChatId ?? null,
    })
    .where(eq(sites.id, parsed.data.siteId))
    .run();
  return c.json({ ok: true });
});
