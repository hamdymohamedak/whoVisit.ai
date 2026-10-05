import { serve } from "@hono/node-server";
import { buildWhoVisitApp } from "./app.js";
import {
  applySettingsOnBoot,
  loadSettings,
  resolveDatabasePath,
} from "./settings.js";

const settingsPath = process.env.WHOVISIT_SETTINGS;
const settings = loadSettings(settingsPath);

if (settingsPath) {
  process.env.DATABASE_URL = resolveDatabasePath(settingsPath, settings);
}

const apiKey =
  applySettingsOnBoot(settings, settingsPath) ?? settings.site.apiKey ?? "";

const app = buildWhoVisitApp(settings, apiKey);

const port = Number(process.env.PORT || 8787);
console.log(`WhoVisit API http://localhost:${port}`);
serve({ fetch: app.fetch, port });
