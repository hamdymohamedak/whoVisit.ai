import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { events, sessions } from "../db/schema.js";

export const analyticsRoute = new Hono();

analyticsRoute.get("/analytics/:siteId/summary", (c) => {
  const siteId = c.req.param("siteId");

  const byCategory = db
    .select({
      sourceCategory: events.sourceCategory,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(events)
    .where(eq(events.siteId, siteId))
    .groupBy(events.sourceCategory)
    .all();

  const aiPlatforms = db
    .select({
      platform: events.sourcePlatform,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(events)
    .where(sql`${events.siteId} = ${siteId} AND ${events.sourceCategory} = 'ai' AND ${events.trafficKind} = 'human'`)
    .groupBy(events.sourcePlatform)
    .all();

  const aiCrawlers = db
    .select({
      botName: events.botName,
      pagePath: events.pagePath,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(events)
    .where(sql`${events.siteId} = ${siteId} AND ${events.isBot} = 1 AND ${events.sourceCategory} = 'ai'`)
    .groupBy(events.botName, events.pagePath)
    .all();

  const topLanding = db
    .select({
      path: sessions.landingPage,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(sessions)
    .where(sql`${sessions.siteId} = ${siteId} AND ${sessions.sourceCategory} = 'ai'`)
    .groupBy(sessions.landingPage)
    .orderBy(sql`count(*) desc`)
    .limit(10)
    .all();

  const conversions = db
    .select({
      sourcePlatform: sessions.sourcePlatform,
      sourceCategory: sessions.sourceCategory,
      visitors: sql<number>`count(*)`.mapWith(Number),
      signups: sql<number>`sum(case when ${sessions.converted} then 1 else 0 end)`.mapWith(Number),
      revenue: sql<number>`coalesce(sum(${sessions.revenue}), 0)`.mapWith(Number),
    })
    .from(sessions)
    .where(eq(sessions.siteId, siteId))
    .groupBy(sessions.sourceCategory, sessions.sourcePlatform)
    .all();

  const total = byCategory.reduce((a, r) => a + r.count, 0);

  return c.json({
    siteId,
    totalEvents: total,
    byCategory,
    aiPlatforms,
    aiCrawlers,
    aiLandingPages: topLanding,
    conversionAttribution: conversions,
  });
});

analyticsRoute.get("/analytics/:siteId/events", (c) => {
  const siteId = c.req.param("siteId");
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const rows = db
    .select()
    .from(events)
    .where(eq(events.siteId, siteId))
    .orderBy(sql`${events.createdAt} desc`)
    .limit(limit)
    .all();
  return c.json({ events: rows });
});
