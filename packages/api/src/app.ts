import { Hono } from "hono";
import { cors } from "hono/cors";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./db/index.js";
import { seedSourceRegistry } from "./db/seed.js";
import { eventsRoute } from "./routes/events.js";
import { analyticsRoute } from "./routes/analytics.js";
import { redirectRoute } from "./routes/redirect.js";
import { siteConfigRoute } from "./routes/site-config.js";
import type { WhoVisitSettings } from "./settings.js";
import { frontendScriptTag, publicBaseUrl } from "./settings.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(__dirname, "../drizzle");

function initDb() {
  try {
    if (existsSync(migrationsFolder)) {
      migrate(db, { migrationsFolder });
    }
  } catch {
    /* */
  }
  seedSourceRegistry();
}

function embedLoaderScript(settings: WhoVisitSettings, apiBase: string, apiKey: string): string {
  const cfg = {
    siteId: settings.site.id,
    apiKey,
    apiBase,
    autoTrack: settings.tracking?.autoPageView !== false,
    notify: {
      aiOnly: settings.notify?.aiOnly ?? false,
      minConfidence: settings.notify?.minConfidence ?? "low",
    },
  };
  const sdkUrl = `${apiBase}/v1.js`;
  return `(function(){
  window.__WHOVISIT_CONFIG__=${JSON.stringify(cfg)};
  var s=document.createElement("script");
  s.src=${JSON.stringify(sdkUrl)};
  s.async=true;
  document.head.appendChild(s);
})();`;
}

export function buildWhoVisitApp(settings: WhoVisitSettings, apiKey: string) {
  initDb();

  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    })
  );

  app.route("/v1", eventsRoute);
  app.route("/v1", analyticsRoute);
  app.route("/v1", redirectRoute);
  app.route("/v1", siteConfigRoute);

  app.get("/health", (c) => c.json({ ok: true, siteId: settings.site.id }));

  app.get("/embed.js", (c) => {
    const origin = new URL(c.req.url).origin;
    const base = publicBaseUrl(settings, origin);
    if (!settings.backendUrl && !settings.publicUrl) {
      console.warn(
        "[WhoVisit] settings.backendUrl is empty — set it to your backend origin so a separate frontend can talk to the API."
      );
    }
    const js = embedLoaderScript(settings, base, apiKey);
    return c.body(js, 200, {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=60",
    });
  });

  app.get("/", (c) => {
    const tag = frontendScriptTag(settings, new URL(c.req.url).origin);
    return c.html(`<!DOCTYPE html><html><body style="font-family:system-ui;padding:2rem">
<h1>WhoVisit</h1>
<p>Frontend is separate — use the <strong>full backend URL</strong>:</p>
<pre>${tag.replace(/</g, "&lt;")}</pre>
<p>Set <code>backendUrl</code> in <code>whoVisit/settings.json</code> to this API origin.</p>
<p><a href="./health">health</a></p>
</body></html>`);
  });

  const sdkPath = join(__dirname, "../../sdk/dist/v1.js");
  app.get("/v1.js", (c) => {
    if (!existsSync(sdkPath)) {
      return c.text("SDK not built. Run pnpm run build", 503);
    }
    return c.body(readFileSync(sdkPath, "utf-8"), 200, {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=300",
    });
  });

  return app;
}
