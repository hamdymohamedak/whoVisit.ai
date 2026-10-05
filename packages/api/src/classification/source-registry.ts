export type SourceCategory =
  | "ai"
  | "search"
  | "social"
  | "referral"
  | "direct"
  | "unknown"
  | "paid";

export type TrafficKind = "human" | "bot";

export type Confidence = "high" | "medium" | "low" | "unknown";

export interface ClassificationResult {
  trafficKind: TrafficKind;
  sourceCategory: SourceCategory;
  sourcePlatform: string | null;
  confidence: Confidence;
  confidenceScore: number;
  searchQuery: string | null;
  botName: string | null;
  subtype?: "ai_crawler" | "search_crawler" | "other_bot" | "ai_recommendation";
}

/** Default registry — also seeded in DB for server-side updates without SDK release */
export const DEFAULT_SOURCE_REGISTRY: Record<
  string,
  { category: SourceCategory; platform: string }
> = {
  "chatgpt.com": { category: "ai", platform: "chatgpt" },
  "chat.openai.com": { category: "ai", platform: "chatgpt" },
  "openai.com": { category: "ai", platform: "chatgpt" },
  "perplexity.ai": { category: "ai", platform: "perplexity" },
  "gemini.google.com": { category: "ai", platform: "gemini" },
  "bard.google.com": { category: "ai", platform: "gemini" },
  "claude.ai": { category: "ai", platform: "claude" },
  "copilot.microsoft.com": { category: "ai", platform: "copilot" },
  "you.com": { category: "ai", platform: "you" },
  "phind.com": { category: "ai", platform: "phind" },
  "poe.com": { category: "ai", platform: "poe" },
  "google.com": { category: "search", platform: "google" },
  "www.google.com": { category: "search", platform: "google" },
  "bing.com": { category: "search", platform: "bing" },
  "www.bing.com": { category: "search", platform: "bing" },
  "yahoo.com": { category: "search", platform: "yahoo" },
  "duckduckgo.com": { category: "search", platform: "duckduckgo" },
  "yandex.com": { category: "search", platform: "yandex" },
  "baidu.com": { category: "search", platform: "baidu" },
  "facebook.com": { category: "social", platform: "facebook" },
  "instagram.com": { category: "social", platform: "instagram" },
  "linkedin.com": { category: "social", platform: "linkedin" },
  "x.com": { category: "social", platform: "x" },
  "twitter.com": { category: "social", platform: "x" },
  "reddit.com": { category: "social", platform: "reddit" },
  "t.co": { category: "social", platform: "x" },
};

export const BOT_SIGNATURES: { pattern: RegExp; name: string; kind: "ai_crawler" | "search_crawler" | "other_bot" }[] = [
  { pattern: /GPTBot/i, name: "GPTBot", kind: "ai_crawler" },
  { pattern: /ChatGPT-User/i, name: "ChatGPT-User", kind: "ai_crawler" },
  { pattern: /ClaudeBot/i, name: "ClaudeBot", kind: "ai_crawler" },
  { pattern: /anthropic-ai/i, name: "Anthropic-AI", kind: "ai_crawler" },
  { pattern: /PerplexityBot/i, name: "PerplexityBot", kind: "ai_crawler" },
  { pattern: /Google-Extended/i, name: "Google-Extended", kind: "ai_crawler" },
  { pattern: /Googlebot/i, name: "Googlebot", kind: "search_crawler" },
  { pattern: /bingbot/i, name: "Bingbot", kind: "search_crawler" },
  { pattern: /bot|crawler|spider|slurp/i, name: "GenericBot", kind: "other_bot" },
];

export function extractDomain(referrer: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function extractSearchQuery(referrer: string, platform: string | null): string | null {
  if (!referrer || !platform) return null;
  try {
    const u = new URL(referrer);
    if (platform === "google" && u.pathname.includes("/search")) {
      return u.searchParams.get("q");
    }
    if (platform === "bing") {
      return u.searchParams.get("q");
    }
    if (platform === "yahoo") {
      return u.searchParams.get("p");
    }
    if (platform === "duckduckgo") {
      return u.searchParams.get("q");
    }
  } catch {
    return null;
  }
  return null;
}

const AI_UTM_SOURCES = new Set([
  "chatgpt",
  "openai",
  "perplexity",
  "gemini",
  "claude",
  "copilot",
  "you",
  "phind",
]);

export function classifyVisit(input: {
  referrer: string;
  utm: Record<string, string>;
  userAgent: string;
  registry: Record<string, { category: SourceCategory; platform: string }>;
}): ClassificationResult {
  const { referrer, utm, userAgent, registry } = input;
  const mergedRegistry = { ...DEFAULT_SOURCE_REGISTRY, ...registry };

  for (const sig of BOT_SIGNATURES) {
    if (sig.pattern.test(userAgent)) {
      const isAi = sig.kind === "ai_crawler";
      return {
        trafficKind: "bot",
        sourceCategory: isAi ? "ai" : sig.kind === "search_crawler" ? "search" : "unknown",
        sourcePlatform: sig.name,
        confidence: "high",
        confidenceScore: 0.99,
        searchQuery: null,
        botName: sig.name,
        subtype: sig.kind,
      };
    }
  }

  const utmSource = (utm.source || "").toLowerCase();
  const utmMedium = (utm.medium || "").toLowerCase();

  if (utmSource && (utmMedium === "ai" || AI_UTM_SOURCES.has(utmSource))) {
    return {
      trafficKind: "human",
      sourceCategory: "ai",
      sourcePlatform: utmSource,
      confidence: "high",
      confidenceScore: 1,
      searchQuery: null,
      botName: null,
      subtype: "ai_recommendation",
    };
  }

  if (utmMedium === "cpc" || utmMedium === "ppc" || utmMedium === "paid") {
    return {
      trafficKind: "human",
      sourceCategory: "paid",
      sourcePlatform: utmSource || "paid",
      confidence: "high",
      confidenceScore: 0.95,
      searchQuery: null,
      botName: null,
    };
  }

  const domain = extractDomain(referrer);
  if (domain) {
    const reg = mergedRegistry[domain] || mergedRegistry[`www.${domain}`];
    if (reg) {
      const query =
        reg.category === "search"
          ? extractSearchQuery(referrer, reg.platform)
          : null;
      return {
        trafficKind: "human",
        sourceCategory: reg.category,
        sourcePlatform: reg.platform,
        confidence: "high",
        confidenceScore: 0.92,
        searchQuery: query,
        botName: null,
        subtype: reg.category === "ai" ? "ai_recommendation" : undefined,
      };
    }
    return {
      trafficKind: "human",
      sourceCategory: "referral",
      sourcePlatform: domain,
      confidence: "medium",
      confidenceScore: 0.7,
      searchQuery: null,
      botName: null,
    };
  }

  if (!referrer) {
    if (utmSource && AI_UTM_SOURCES.has(utmSource)) {
      return {
        trafficKind: "human",
        sourceCategory: "ai",
        sourcePlatform: utmSource,
        confidence: "medium",
        confidenceScore: 0.75,
        searchQuery: null,
        botName: null,
        subtype: "ai_recommendation",
      };
    }
    return {
      trafficKind: "human",
      sourceCategory: "unknown",
      sourcePlatform: null,
      confidence: "low",
      confidenceScore: 0.35,
      searchQuery: null,
      botName: null,
    };
  }

  return {
    trafficKind: "human",
    sourceCategory: "unknown",
    sourcePlatform: null,
    confidence: "unknown",
    confidenceScore: 0.2,
    searchQuery: null,
    botName: null,
  };
}
