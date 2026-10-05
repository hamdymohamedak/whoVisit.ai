import { getRequestListener } from "@hono/node-server";
import type { Express } from "express";
import type { WhoVisitSettings } from "../settings.js";

export type AttachWhoVisitOptions = {
  settingsPath: string;
  settings?: WhoVisitSettings;
};

export async function attachWhoVisitToExpress(
  expressApp: Express,
  options: AttachWhoVisitOptions
) {
  const { loadSettings, resolveDatabasePath, applySettingsOnBoot } = await import(
    "../settings.js"
  );
  const settings = options.settings ?? loadSettings(options.settingsPath);
  process.env.DATABASE_URL = resolveDatabasePath(options.settingsPath, settings);

  await import("../db/index.js");

  const apiKey = applySettingsOnBoot(settings, options.settingsPath);
  const { buildWhoVisitApp } = await import("../app.js");
  const hono = buildWhoVisitApp(settings, apiKey);
  const listener = getRequestListener(hono.fetch);

  const mount = (settings.mountPath ?? "/whovisit").replace(/\/$/, "") || "/whovisit";

  expressApp.use(mount, (req, res) => {
    const original = req.url;
    const stripped = original.startsWith(mount)
      ? original.slice(mount.length) || "/"
      : original;
    req.url = stripped;
    listener(req, res);
  });

  console.info(`[WhoVisit] mounted at ${mount} (site: ${settings.site.id})`);
  return { mountPath: mount, siteId: settings.site.id, apiKey };
}
