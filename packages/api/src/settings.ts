import { readFileSync, existsSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { sites } from "./db/schema.js";
import { createSiteWithKey, ensureSite } from "./db/seed.js";

export type WhoVisitSettings = {
  mountPath?: string;
  /**
   * Public origin of the BACKEND that mounts WhoVisit
   * (e.g. https://api.mysite.com). Used in embed.js apiBase.
   * Frontend must load: {backendUrl}{mountPath}/embed.js
   */
  backendUrl?: string;
  /** @deprecated use backendUrl — kept for older settings.json */
  publicUrl?: string;
  site: {
    id: string;
    apiKey?: string;
    name?: string;
  };
  notify?: {
    discordWebhook?: string;
    telegramBotToken?: string;
    telegramChatId?: string;
    aiOnly?: boolean;
    minConfidence?: "low" | "medium" | "high";
    conversions?: boolean;
  };
  database?: {
    path?: string;
  };
  tracking?: {
    autoPageView?: boolean;
  };
};

const defaults: WhoVisitSettings = {
  mountPath: "/whovisit",
  backendUrl: "",
  publicUrl: "",
  site: { id: "default_site" },
  notify: {
    aiOnly: false,
    minConfidence: "low",
    conversions: true,
  },
  database: { path: "./data/whovisit.db" },
  tracking: { autoPageView: true },
};

export function loadSettings(settingsPath?: string): WhoVisitSettings {
  if (!settingsPath || !existsSync(settingsPath)) {
    return structuredClone(defaults);
  }
  const raw = JSON.parse(readFileSync(settingsPath, "utf-8")) as Partial<WhoVisitSettings>;
  return {
    ...defaults,
    ...raw,
    site: { ...defaults.site, ...raw.site },
    notify: { ...defaults.notify, ...raw.notify },
    database: { ...defaults.database, ...raw.database },
    tracking: { ...defaults.tracking, ...raw.tracking },
  };
}

export function resolveDatabasePath(settingsPath: string, settings: WhoVisitSettings): string {
  const rel = settings.database?.path ?? "./data/whovisit.db";
  return resolve(dirname(settingsPath), rel);
}

/** Apply settings.json → DB (notify, keys). Does not touch your main app. */
export function applySettingsOnBoot(settings: WhoVisitSettings, settingsPath?: string) {
  const siteId = settings.site.id;
  ensureSite(siteId);

  let apiKey = settings.site.apiKey;
  if (!apiKey) {
    apiKey = createSiteWithKey(siteId, settings.site.name);
    if (settingsPath) {
      try {
        const file = JSON.parse(readFileSync(settingsPath, "utf-8")) as WhoVisitSettings;
        file.site = { ...file.site, id: siteId, apiKey };
        writeFileSync(settingsPath, `${JSON.stringify(file, null, 2)}\n`, "utf-8");
        console.info(`[WhoVisit] Wrote new apiKey to ${settingsPath}`);
      } catch {
        console.info(`[WhoVisit] site apiKey: ${apiKey}`);
      }
    }
  } else {
    createSiteWithKey(siteId, settings.site.name);
    db.update(sites).set({ apiKey }).where(eq(sites.id, siteId)).run();
  }

  const n = settings.notify ?? {};
  db.update(sites)
    .set({
      discordWebhook: n.discordWebhook ?? null,
      telegramBotToken: n.telegramBotToken ?? null,
      telegramChatId: n.telegramChatId ?? null,
      notifyAiOnly: n.aiOnly ?? false,
      notifyMinConfidence: n.minConfidence ?? "low",
      notifyConversions: n.conversions ?? true,
      name: settings.site.name ?? siteId,
    })
    .where(eq(sites.id, siteId))
    .run();

  return apiKey;
}

export function publicBaseUrl(settings: WhoVisitSettings, requestOrigin?: string): string {
  const origin = (
    settings.backendUrl ||
    settings.publicUrl ||
    requestOrigin ||
    ""
  ).replace(/\/$/, "");
  const mount = (settings.mountPath ?? "/whovisit").replace(/\/$/, "");
  return `${origin}${mount}`;
}

/** Snippet for a separate frontend (absolute URL to your backend). */
export function frontendScriptTag(settings: WhoVisitSettings, requestOrigin?: string): string {
  const base = publicBaseUrl(settings, requestOrigin);
  return `<script src="${base}/embed.js" async></script>`;
}
