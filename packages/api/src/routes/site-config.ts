import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { requireSiteAuth, type WhoVisitEnv } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { sites } from "../db/schema.js";
import { createSiteWithKey, ensureSite } from "../db/seed.js";
import { attributionLinks } from "../db/schema.js";

export const siteConfigRoute = new Hono<WhoVisitEnv>();

function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function publicSiteConfig(site: typeof sites.$inferSelect, baseUrl: string) {
  return {
    siteId: site.id,
    name: site.name,
    apiKeyHint: site.apiKey ? maskSecret(site.apiKey) : null,
    notify: {
      aiOnly: Boolean(site.notifyAiOnly),
      minConfidence: site.notifyMinConfidence ?? "low",
      conversions: site.notifyConversions ?? true,
      discordConfigured: Boolean(site.discordWebhook),
      telegramConfigured: Boolean(site.telegramBotToken && site.telegramChatId),
    },
    integrations: {
      discordWebhook: site.discordWebhook ?? null,
      telegramBotToken: site.telegramBotToken ?? null,
      telegramChatId: site.telegramChatId ?? null,
    },
    attribution: {
      redirectBase: `${baseUrl}/v1/r`,
    },
  };
}

siteConfigRoute.get("/site/config", requireSiteAuth, (c) => {
  const site = c.get("site") as typeof sites.$inferSelect;
  const baseUrl = new URL(c.req.url).origin;
  return c.json(publicSiteConfig(site, baseUrl));
});

const patchSchema = z.object({
  name: z.string().optional(),
  notify: z
    .object({
      aiOnly: z.boolean().optional(),
      minConfidence: z.enum(["low", "medium", "high"]).optional(),
      conversions: z.boolean().optional(),
    })
    .optional(),
  integrations: z
    .object({
      discordWebhook: z.string().url().nullable().optional(),
      telegramBotToken: z.string().nullable().optional(),
      telegramChatId: z.string().nullable().optional(),
    })
    .optional(),
});

siteConfigRoute.patch("/site/config", requireSiteAuth, async (c) => {
  const siteId = c.get("siteId") as string;
  const body = await c.req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.notify?.aiOnly !== undefined) {
    patch.notifyAiOnly = parsed.data.notify.aiOnly;
  }
  if (parsed.data.notify?.minConfidence !== undefined) {
    patch.notifyMinConfidence = parsed.data.notify.minConfidence;
  }
  if (parsed.data.notify?.conversions !== undefined) {
    patch.notifyConversions = parsed.data.notify.conversions;
  }
  if (parsed.data.integrations?.discordWebhook !== undefined) {
    patch.discordWebhook = parsed.data.integrations.discordWebhook;
  }
  if (parsed.data.integrations?.telegramBotToken !== undefined) {
    patch.telegramBotToken = parsed.data.integrations.telegramBotToken;
  }
  if (parsed.data.integrations?.telegramChatId !== undefined) {
    patch.telegramChatId = parsed.data.integrations.telegramChatId;
  }

  if (Object.keys(patch).length > 0) {
    db.update(sites).set(patch).where(eq(sites.id, siteId)).run();
  }

  const site = db.select().from(sites).where(eq(sites.id, siteId)).get()!;
  const baseUrl = new URL(c.req.url).origin;
  return c.json(publicSiteConfig(site, baseUrl));
});

/** Rotate or create API key (requires current valid key). */
siteConfigRoute.post("/site/rotate-key", requireSiteAuth, (c) => {
  const siteId = c.get("siteId") as string;
  const newKey = `wv_${nanoid(24)}`;
  db.update(sites).set({ apiKey: newKey }).where(eq(sites.id, siteId)).run();
  return c.json({ siteId, apiKey: newKey });
});

siteConfigRoute.get("/site/links", requireSiteAuth, (c) => {
  const siteId = c.get("siteId") as string;
  const baseUrl = new URL(c.req.url).origin;
  const links = db
    .select()
    .from(attributionLinks)
    .where(eq(attributionLinks.siteId, siteId))
    .all();
  return c.json({
    links: links.map((l) => ({
      ...l,
      url: `${baseUrl}/v1/r/${l.id}`,
    })),
  });
});

/** Bootstrap: create site + return api key (open for dev — lock down in production). */
const registerSchema = z.object({
  siteId: z.string().min(3).optional(),
});

siteConfigRoute.post("/site/register", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = registerSchema.safeParse(body);
  const siteId = parsed.success && parsed.data.siteId ? parsed.data.siteId : `site_${Date.now()}`;
  const apiKey = createSiteWithKey(siteId);
  return c.json({
    siteId,
    apiKey,
    message: "Store apiKey securely; use data-key on script tag.",
  });
});

const createLinkSchema = z.object({
  targetUrl: z.string().url(),
  label: z.string().optional(),
  sourcePlatform: z.string().optional(),
});

siteConfigRoute.post("/site/links", requireSiteAuth, async (c) => {
  const siteId = c.get("siteId") as string;
  const body = await c.req.json();
  const parsed = createLinkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const id = nanoid(10);
  db.insert(attributionLinks)
    .values({
      id,
      siteId,
      targetUrl: parsed.data.targetUrl,
      label: parsed.data.label,
      sourcePlatform: parsed.data.sourcePlatform,
      hits: 0,
      createdAt: new Date().toISOString(),
    })
    .run();
  const baseUrl = new URL(c.req.url).origin;
  return c.json({
    id,
    url: `${baseUrl}/v1/r/${id}`,
  });
});
