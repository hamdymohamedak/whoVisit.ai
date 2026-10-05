import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const sites = sqliteTable("sites", {
  id: text("id").primaryKey(),
  name: text("name"),
  discordWebhook: text("discord_webhook"),
  telegramBotToken: text("telegram_bot_token"),
  telegramChatId: text("telegram_chat_id"),
  createdAt: text("created_at").notNull(),
});

export const sourceRegistry = sqliteTable("source_registry", {
  domain: text("domain").primaryKey(),
  category: text("category").notNull(),
  platform: text("platform").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull(),
  trafficKind: text("traffic_kind").notNull(),
  sourceCategory: text("source_category").notNull(),
  sourcePlatform: text("source_platform"),
  confidence: text("confidence").notNull(),
  landingPage: text("landing_page").notNull(),
  country: text("country"),
  deviceType: text("device_type"),
  converted: integer("converted", { mode: "boolean" }).default(false),
  revenue: real("revenue").default(0),
  startedAt: text("started_at").notNull(),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull(),
  sessionId: text("session_id").notNull(),
  eventType: text("event_type").notNull(),
  pagePath: text("page_path"),
  pageUrl: text("page_url"),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  rawUtm: text("raw_utm"),
  trafficKind: text("traffic_kind"),
  sourceCategory: text("source_category"),
  sourcePlatform: text("source_platform"),
  confidence: text("confidence"),
  searchQuery: text("search_query"),
  isBot: integer("is_bot", { mode: "boolean" }).default(false),
  botName: text("bot_name"),
  payload: text("payload"),
  createdAt: text("created_at").notNull(),
});

export const attributionLinks = sqliteTable("attribution_links", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull(),
  targetUrl: text("target_url").notNull(),
  label: text("label"),
  sourcePlatform: text("source_platform"),
  hits: integer("hits").default(0),
  createdAt: text("created_at").notNull(),
});
