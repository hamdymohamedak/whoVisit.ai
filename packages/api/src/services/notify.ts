import type { ClassificationResult } from "../classification/source-registry.js";
import type { VisitDeviceInfo, VisitGeo } from "./visit-context.js";

export interface VisitNotification {
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
}

function formatAttribution(utm: Record<string, string> | undefined): string | null {
  if (!utm || Object.keys(utm).length === 0) return null;
  const parts = [
    utm.source && `source=${utm.source}`,
    utm.medium && `medium=${utm.medium}`,
    utm.campaign && `campaign=${utm.campaign}`,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function formatLocation(geo: VisitGeo): string {
  if (geo.isLocal) return geo.countryName ?? "Local";
  const bits = [geo.city, geo.region, geo.countryName ?? geo.country].filter(Boolean);
  return bits.length ? bits.join(", ") : "Unknown";
}

function formatMessage(n: VisitNotification): string {
  const c = n.classification;
  const platform = c.sourcePlatform || "—";
  const kind = c.trafficKind === "bot" ? `🤖 Bot (${c.botName})` : "👤 Human";
  const utmLine = formatAttribution(n.utm);

  const lines = [
    `**WhoVisit** · ${n.siteId}`,
    `Event: \`${n.eventType}\``,
    n.eventType === "conversion" && n.revenue != null && n.revenue > 0
      ? `💰 Revenue: **$${n.revenue.toFixed(2)}**`
      : null,
    `Page: \`${n.pagePath}\``,
    "",
    "**Traffic**",
    `${kind}`,
    `Source: **${c.sourceCategory}** / ${platform}`,
    c.subtype === "estimated_ai"
      ? `_Estimated AI traffic (not confirmed)_`
      : null,
    `Confidence: ${c.confidence} (${Math.round(c.confidenceScore * 100)}%)`,
    n.referrer ? `Referrer: ${n.referrer}` : "Referrer: (empty)",
    utmLine ? `UTM: ${utmLine}` : null,
    c.searchQuery ? `Search query: ${c.searchQuery}` : null,
    "",
    "**Visitor**",
    `Location: ${formatLocation(n.geo)}`,
    n.geo.isLocal ? `IP: ${n.geo.ip} (local dev)` : `IP: ${n.geo.ip}`,
    n.geo.timezone ? `Geo TZ: ${n.geo.timezone}` : null,
    `Device: ${n.device.type}`,
    `Browser: ${n.device.browser}`,
    `OS: ${n.device.os}`,
    n.device.language ? `Language: ${n.device.language}` : null,
    n.device.screen ? `Screen: ${n.device.screen}` : null,
    n.device.timezone ? `Browser TZ: ${n.device.timezone}` : null,
  ];
  return lines.filter((line) => line !== null).join("\n");
}

export async function sendDiscordWebhook(webhookUrl: string, n: VisitNotification) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: formatMessage(n) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord webhook ${res.status}: ${text.slice(0, 200)}`);
  }
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
