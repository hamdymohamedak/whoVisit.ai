import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db/index.js";
import { attributionLinks } from "../db/schema.js";
import { ensureSite } from "../db/seed.js";

export const redirectRoute = new Hono();

redirectRoute.get("/r/:linkId", (c) => {
  const linkId = c.req.param("linkId");
  const link = db
    .select()
    .from(attributionLinks)
    .where(eq(attributionLinks.id, linkId))
    .get();
  if (!link) {
    return c.text("Not found", 404);
  }
  db.update(attributionLinks)
    .set({ hits: (link.hits ?? 0) + 1 })
    .where(eq(attributionLinks.id, linkId))
    .run();

  const target = new URL(link.targetUrl);
  if (link.sourcePlatform) {
    target.searchParams.set("utm_source", link.sourcePlatform);
    target.searchParams.set("utm_medium", "ai");
    target.searchParams.set("wv_link", linkId);
  }
  return c.redirect(target.toString(), 302);
});

const createLinkSchema = z.object({
  siteId: z.string(),
  targetUrl: z.string().url(),
  label: z.string().optional(),
  sourcePlatform: z.string().optional(),
});

redirectRoute.post("/links", async (c) => {
  const body = await c.req.json();
  const parsed = createLinkSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  ensureSite(parsed.data.siteId);
  const id = nanoid(10);
  db.insert(attributionLinks)
    .values({
      id,
      siteId: parsed.data.siteId,
      targetUrl: parsed.data.targetUrl,
      label: parsed.data.label,
      sourcePlatform: parsed.data.sourcePlatform,
      hits: 0,
      createdAt: new Date().toISOString(),
    })
    .run();
  const base = new URL(c.req.url).origin;
  return c.json({
    id,
    url: `${base}/v1/r/${id}`,
  });
});

redirectRoute.get("/links/:siteId", (c) => {
  const siteId = c.req.param("siteId");
  const links = db
    .select()
    .from(attributionLinks)
    .where(eq(attributionLinks.siteId, siteId))
    .all();
  return c.json({ links });
});
