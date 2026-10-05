import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./index.js";
import { sourceRegistry, sites } from "./schema.js";
import { DEFAULT_SOURCE_REGISTRY } from "../classification/source-registry.js";

export function seedSourceRegistry() {
  for (const [domain, meta] of Object.entries(DEFAULT_SOURCE_REGISTRY)) {
    db.insert(sourceRegistry)
      .values({
        domain,
        category: meta.category,
        platform: meta.platform,
      })
      .onConflictDoUpdate({
        target: sourceRegistry.domain,
        set: { category: meta.category, platform: meta.platform },
      })
      .run();
  }
}

export function ensureSite(siteId: string) {
  const existing = db.select().from(sites).where(eq(sites.id, siteId)).get();
  if (!existing) {
    db.insert(sites)
      .values({
        id: siteId,
        name: siteId,
        createdAt: new Date().toISOString(),
      })
      .run();
  }
}

export function createSiteWithKey(siteId: string, name?: string) {
  ensureSite(siteId);
  const existing = db.select().from(sites).where(eq(sites.id, siteId)).get();
  if (existing?.apiKey) return existing.apiKey;
  const apiKey = `wv_${nanoid(24)}`;
  db.update(sites)
    .set({ apiKey, name: name ?? siteId })
    .where(eq(sites.id, siteId))
    .run();
  return apiKey;
}
