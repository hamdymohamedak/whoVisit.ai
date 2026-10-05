import Database from "better-sqlite3";

/** Bootstrap schema when drizzle migrations folder is empty (local dev). */
export function ensureTables(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT,
      discord_webhook TEXT,
      telegram_bot_token TEXT,
      telegram_chat_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS source_registry (
      domain TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      platform TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      traffic_kind TEXT NOT NULL,
      source_category TEXT NOT NULL,
      source_platform TEXT,
      confidence TEXT NOT NULL,
      landing_page TEXT NOT NULL,
      country TEXT,
      device_type TEXT,
      converted INTEGER DEFAULT 0,
      revenue REAL DEFAULT 0,
      started_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      page_path TEXT,
      page_url TEXT,
      referrer TEXT,
      user_agent TEXT,
      raw_utm TEXT,
      traffic_kind TEXT,
      source_category TEXT,
      source_platform TEXT,
      confidence TEXT,
      search_query TEXT,
      is_bot INTEGER DEFAULT 0,
      bot_name TEXT,
      payload TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attribution_links (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      target_url TEXT NOT NULL,
      label TEXT,
      source_platform TEXT,
      hits INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
}
