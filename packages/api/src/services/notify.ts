import type { ClassificationResult } from "../classification/source-registry.js";

export interface VisitNotification {
  siteId: string;
  eventType: string;
  pagePath: string;
  classification: ClassificationResult;
  referrer: string;
}

function formatMessage(n: VisitNotification): string {
  const c = n.classification;
  const platform = c.sourcePlatform || "—";
  const kind = c.trafficKind === "bot" ? `🤖 Bot (${c.botName})` : "👤 Human";
  return [
    `**WhoVisit** · ${n.siteId}`,
    `Event: \`${n.eventType}\``,
    `Page: \`${n.pagePath}\``,
    `${kind}`,
    `Source: **${c.sourceCategory}** / ${platform}`,
    `Confidence: ${c.confidence} (${Math.round(c.confidenceScore * 100)}%)`,
    n.referrer ? `Referrer: ${n.referrer}` : "Referrer: (empty)",
    c.searchQuery ? `Search query: ${c.searchQuery}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendDiscordWebhook(webhookUrl: string, n: VisitNotification) {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: formatMessage(n) }),
  });
}

export async function sendTelegram(
  botToken: string,
  chatId: string,
  n: VisitNotification
) {
  const text = formatMessage(n).replace(/\*\*/g, "*");
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });
}
