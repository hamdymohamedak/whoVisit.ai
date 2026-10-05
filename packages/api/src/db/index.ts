import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import * as schema from "./schema.js";

const dbPath = process.env.DATABASE_URL || "./data/whovisit.db";
mkdirSync(dirname(dbPath), { recursive: true });

import { ensureTables } from "./init.js";

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
ensureTables(sqlite);

export const db = drizzle(sqlite, { schema });
