import { eq } from "drizzle-orm";
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
