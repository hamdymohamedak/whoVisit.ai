import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./db/index.js";
import { seedSourceRegistry } from "./db/seed.js";
import { eventsRoute } from "./routes/events.js";
import { analyticsRoute } from "./routes/analytics.js";
import { redirectRoute } from "./routes/redirect.js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(__dirname, "../drizzle");

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
  })
);

app.route("/v1", eventsRoute);
app.route("/v1", analyticsRoute);
app.route("/v1", redirectRoute);

app.get("/health", (c) => c.json({ ok: true }));

const sdkPath = join(__dirname, "../../sdk/dist/v1.js");
app.get("/v1.js", (c) => {
  if (!existsSync(sdkPath)) {
    return c.text("SDK not built. Run npm run build -w @whovisit/sdk", 503);
  }
  const js = readFileSync(sdkPath, "utf-8");
  return c.body(js, 200, {
    "Content-Type": "application/javascript",
    "Cache-Control": "public, max-age=300",
  });
});

function initDb() {
  try {
    if (existsSync(migrationsFolder)) {
      migrate(db, { migrationsFolder });
    }
  } catch {
    // tables created via push
  }
  seedSourceRegistry();
}

initDb();

const port = Number(process.env.PORT || 8787);
console.log(`WhoVisit API http://localhost:${port}`);
serve({ fetch: app.fetch, port });
