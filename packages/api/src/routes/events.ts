import { Hono } from "hono";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { UAParser } from "ua-parser-js";
import { z } from "zod";
import { classifyVisit } from "../classification/source-registry.js";
import { db } from "../db/index.js";
import { ensureSite, seedSourceRegistry } from "../db/seed.js";
import { events, sessions, sites, sourceRegistry } from "../db/schema.js";
import {
  buildNotification,
  dispatchVisitNotify,
} from "../services/dispatch-notify.js";
import { classificationFromSession } from "../services/session-attribution.js";
import {
  buildDeviceInfo,
  getClientIp,
  lookupGeo,
} from "../services/visit-context.js";
import { verifyEventAuth } from "../middleware/auth.js";

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
  hints: z
    .object({
      ref: z.string().optional(),
      via: z.string().optional(),
    })
    .optional(),
  device: z.record(z.string()).optional(),
  revenue: z.number().optional(),
  value: z.number().optional(),
  discordWebhook: z.string().url().optional(),
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

  const apiKeyHeader =
    c.req.header("x-whovisit-key") ||
    c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!verifyEventAuth(data.siteId, apiKeyHeader)) {
    return c.json({ error: "Invalid API key for site" }, 403);
  }

  if (data.discordWebhook) {
    db.update(sites)
      .set({ discordWebhook: data.discordWebhook })
      .where(eq(sites.id, data.siteId))
      .run();
  }

  const userAgent = c.req.header("user-agent") || "";
  const utm = { ...data.utm };
  if (!utm.source && data.hints?.via) utm.source = data.hints.via;
  if (!utm.source && data.hints?.ref) utm.source = data.hints.ref;

  const classification = classifyVisit({
    referrer: data.referrer,
    utm,
    userAgent,
    registry: loadRegistry(),
  });

  const parser = new UAParser(userAgent);
  const deviceType = parser.getDevice().type || "desktop";
  const clientIp = getClientIp(c);
  const geo = lookupGeo(clientIp);
  const deviceInfo = buildDeviceInfo(parser, data.device);

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
        country: geo.countryName ?? geo.country,
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
  const sessionRow = db
    .select()
    .from(sessions)
    .where(eq(sessions.id, data.sessionId))
    .get();

  if (site && sessionRow) {
    const notifyClassification =
      data.event === "conversion"
        ? classificationFromSession(sessionRow)
        : classification;
    const totalRevenue =
      data.event === "conversion" ? (sessionRow.revenue ?? revenue) : undefined;

    dispatchVisitNotify({
      site,
      discordWebhookOverride: data.discordWebhook,
      sourceCategory: notifyClassification.sourceCategory,
      confidence: notifyClassification.confidence,
      notification: buildNotification({
        siteId: data.siteId,
        eventType: data.event,
        pagePath: data.page.path,
        pageUrl: data.page.url,
        classification: notifyClassification,
        referrer: data.referrer,
        utm: data.utm,
        geo,
        device: deviceInfo,
        revenue: totalRevenue,
      }),
    });
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
  notifyAiOnly: z.boolean().optional(),
  notifyMinConfidence: z.enum(["low", "medium", "high"]).optional(),
  notifyConversions: z.boolean().optional(),
});

eventsRoute.post("/notify-config", async (c) => {
  const body = await c.req.json();
  const parsed = notifyConfigSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  ensureSite(parsed.data.siteId);
  const patch: Record<string, unknown> = {};
  if (parsed.data.discordWebhook !== undefined) {
    patch.discordWebhook = parsed.data.discordWebhook ?? null;
  }
  if (parsed.data.telegramBotToken !== undefined) {
    patch.telegramBotToken = parsed.data.telegramBotToken ?? null;
  }
  if (parsed.data.telegramChatId !== undefined) {
    patch.telegramChatId = parsed.data.telegramChatId ?? null;
  }
  if (parsed.data.notifyAiOnly !== undefined) {
    patch.notifyAiOnly = parsed.data.notifyAiOnly;
  }
  if (parsed.data.notifyMinConfidence !== undefined) {
    patch.notifyMinConfidence = parsed.data.notifyMinConfidence;
  }
  if (parsed.data.notifyConversions !== undefined) {
    patch.notifyConversions = parsed.data.notifyConversions;
  }
  if (Object.keys(patch).length > 0) {
    db.update(sites).set(patch).where(eq(sites.id, parsed.data.siteId)).run();
  }
  return c.json({ ok: true });
});
