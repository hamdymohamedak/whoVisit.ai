import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { db } from "../db/index.js";
import { sites } from "../db/schema.js";
import { ensureSite } from "../db/seed.js";

export type WhoVisitEnv = {
  Variables: {
    siteId: string;
    site: typeof sites.$inferSelect;
  };
};

export function getSiteAuth(c: Context): { siteId: string; apiKey: string } | null {
  const siteId =
    c.req.header("x-whovisit-site") ||
    c.req.query("siteId") ||
    c.req.query("site");
  const apiKey =
    c.req.header("x-whovisit-key") ||
    c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ||
    c.req.query("key") ||
    "";
  if (!siteId || !apiKey) return null;
  return { siteId, apiKey };
}

export async function requireSiteAuth(c: Context<WhoVisitEnv>, next: Next) {
  const auth = getSiteAuth(c);
  if (!auth) {
    return c.json({ error: "Missing X-WhoVisit-Site and X-WhoVisit-Key" }, 401);
  }
  ensureSite(auth.siteId);
  const site = db.select().from(sites).where(eq(sites.id, auth.siteId)).get();
  if (!site?.apiKey || site.apiKey !== auth.apiKey) {
    return c.json({ error: "Invalid site or API key" }, 403);
  }
  c.set("siteId", auth.siteId);
  c.set("site", site);
  await next();
}

/** Events: if site has apiKey, require match; otherwise allow (legacy dev). */
export function verifyEventAuth(siteId: string, apiKeyHeader?: string): boolean {
  const site = db.select().from(sites).where(eq(sites.id, siteId)).get();
  if (!site?.apiKey) return true;
  return apiKeyHeader === site.apiKey;
}
