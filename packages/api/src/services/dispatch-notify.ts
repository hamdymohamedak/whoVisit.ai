import type { ClassificationResult } from "../classification/source-registry.js";
import type { sites } from "../db/schema.js";
import { sendDiscordWebhook, sendTelegram, type VisitNotification } from "./notify.js";
import { shouldSendNotify } from "./notify-policy.js";
import type { VisitDeviceInfo, VisitGeo } from "./visit-context.js";

type SiteRow = typeof sites.$inferSelect;

export function dispatchVisitNotify(input: {
  site: SiteRow;
  discordWebhookOverride?: string;
  notification: VisitNotification;
  sourceCategory: string;
  confidence: ClassificationResult["confidence"];
}): void {
  const { site, notification, sourceCategory, confidence } = input;
  if (
    !shouldSendNotify({
      eventType: notification.eventType,
      sourceCategory,
      confidence,
      notifyAiOnly: Boolean(site.notifyAiOnly),
      notifyMinConfidence: site.notifyMinConfidence,
      notifyConversions: site.notifyConversions ?? true,
    })
  ) {
    return;
  }

  const webhook = input.discordWebhookOverride || site.discordWebhook;
  if (webhook) {
    sendDiscordWebhook(webhook, notification).catch((err) => {
      console.error("[WhoVisit] Discord notify failed:", err);
    });
  }
  if (site.telegramBotToken && site.telegramChatId) {
    sendTelegram(site.telegramBotToken, site.telegramChatId, notification).catch(
      (err) => {
        console.error("[WhoVisit] Telegram notify failed:", err);
      }
    );
  }
}

export function buildNotification(input: {
  siteId: string;
  eventType: string;
  pagePath: string;
  pageUrl?: string;
  classification: ClassificationResult;
  referrer: string;
  utm?: Record<string, string>;
  geo: VisitGeo;
  device: VisitDeviceInfo;
  revenue?: number;
}): VisitNotification {
  return { ...input };
}
