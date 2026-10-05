export type WhoVisitInitOptions = {
  siteId: string;
  apiKey?: string;
  apiBase?: string;
  autoTrack?: boolean;
  notify?: {
    aiOnly?: boolean;
    minConfidence?: "low" | "medium" | "high";
    conversions?: boolean;
  };
  integrations?: {
    discordWebhook?: string | null;
    telegramBotToken?: string | null;
    telegramChatId?: string | null;
  };
};

export type SiteConfig = {
  siteId: string;
  name: string | null;
  apiKeyHint: string | null;
  notify: {
    aiOnly: boolean;
    minConfidence: string;
    conversions: boolean;
    discordConfigured: boolean;
    telegramConfigured: boolean;
  };
  integrations: {
    discordWebhook: string | null;
    telegramBotToken: string | null;
    telegramChatId: string | null;
  };
  attribution: { redirectBase: string };
};

export type WhoVisitClient = {
  version: string;
  init: (options: WhoVisitInitOptions) => Promise<void>;
  getConfig: () => Promise<SiteConfig>;
  configure: (patch: {
    name?: string;
    notify?: WhoVisitInitOptions["notify"];
    integrations?: WhoVisitInitOptions["integrations"];
  }) => Promise<SiteConfig>;
  register: (siteId?: string) => Promise<{ siteId: string; apiKey: string }>;
  rotateKey: () => Promise<{ siteId: string; apiKey: string }>;
  track: (event: string, data?: Record<string, unknown>) => void;
  conversion: (data?: Record<string, unknown>) => void;
  createLink: (input: {
    targetUrl: string;
    sourcePlatform?: string;
    label?: string;
  }) => Promise<{ id: string; url: string }>;
  listLinks: () => Promise<{ links: Array<{ id: string; url: string; targetUrl: string; hits: number | null; label: string | null; sourcePlatform: string | null }> }>;
  getSummary: () => Promise<unknown>;
};

export function createWhoVisitClient(bootstrap?: WhoVisitInitOptions): WhoVisitClient {
  let siteId = bootstrap?.siteId ?? "";
  let apiKey = bootstrap?.apiKey ?? "";
  let apiBase = bootstrap?.apiBase ?? "";
  let autoTrack = bootstrap?.autoTrack !== false;
  let sessionId = "";
  let bootstrapped = false;

  const SESSION_KEY = "wv_sess";
  const KEY_STORAGE = (id: string) => `wv_key_${id}`;

  function authHeaders(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (siteId) h["X-WhoVisit-Site"] = siteId;
    if (apiKey) h["X-WhoVisit-Key"] = apiKey;
    return h;
  }

  function ensureSession() {
    if (sessionId) return;
    sessionId =
      sessionStorage.getItem(SESSION_KEY) ||
      (() => {
        const id = "sess_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        sessionStorage.setItem(SESSION_KEY, id);
        return id;
      })();
  }

  function parseUtm(): Record<string, string> {
    const params = new URLSearchParams(location.search);
    const utm: Record<string, string> = {};
    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
    ]) {
      const v = params.get(key);
      if (v) utm[key.replace("utm_", "")] = v;
    }
    return utm;
  }

  function parseHints() {
    const params = new URLSearchParams(location.search);
    const ref = params.get("ref") || params.get("referrer");
    const via = params.get("via") || params.get("utm_source");
    return {
      ref: ref || undefined,
      via: via || undefined,
    };
  }

  function collectPayload(event: string, extra?: Record<string, unknown>) {
    ensureSession();
    return {
      event,
      siteId,
      sessionId,
      timestamp: new Date().toISOString(),
      page: {
        url: location.href,
        path: location.pathname + location.search,
        title: document.title,
      },
      referrer: document.referrer || "",
      utm: parseUtm(),
      hints: parseHints(),
      device: {
        language: navigator.language,
        screen: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      ...extra,
    };
  }

  async function apiFetch(path: string, init?: RequestInit) {
    const res = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: { ...authHeaders(), ...(init?.headers as Record<string, string>) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status} ${path}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  function sendEvent(payload: ReturnType<typeof collectPayload>, preferFetch?: boolean) {
    const body = JSON.stringify(payload);
    const url = `${apiBase}/v1/events`;
    const headers = authHeaders();
    const mustFetch = preferFetch || Boolean(apiKey);

    if (!mustFetch && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
    fetch(url, { method: "POST", headers, body, keepalive: true }).catch(() => {});
  }

  async function syncRemoteConfig(local: WhoVisitInitOptions) {
    if (!apiKey) return;
    try {
      const patch: Record<string, unknown> = {};
      if (local.notify) patch.notify = local.notify;
      if (local.integrations) patch.integrations = local.integrations;
      if (Object.keys(patch).length > 0) {
        await apiFetch("/v1/site/config", {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
      }
    } catch {
      /* offline or key not yet provisioned */
    }
  }

  async function legacyNotifyConfig(options: WhoVisitInitOptions) {
    const int = options.integrations;
    const n = options.notify;
    if (!int?.discordWebhook && !int?.telegramBotToken) return;
    await fetch(`${apiBase}/v1/notify-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: options.siteId,
        discordWebhook: int.discordWebhook,
        telegramBotToken: int.telegramBotToken,
        telegramChatId: int.telegramChatId,
        notifyAiOnly: n?.aiOnly,
        notifyMinConfidence: n?.minConfidence,
        notifyConversions: n?.conversions,
      }),
    });
  }

  async function init(options: WhoVisitInitOptions) {
    siteId = options.siteId;
    apiBase = options.apiBase ?? apiBase;
    autoTrack = options.autoTrack !== false;
    if (options.apiKey) {
      apiKey = options.apiKey;
      sessionStorage.setItem(KEY_STORAGE(siteId), apiKey);
    } else {
      const stored = sessionStorage.getItem(KEY_STORAGE(siteId));
      if (stored) apiKey = stored;
    }

    if (apiKey && (options.integrations || options.notify)) {
      await syncRemoteConfig(options);
    } else if (options.integrations || options.notify) {
      await legacyNotifyConfig(options);
    }

    if (autoTrack && !bootstrapped) {
      bootstrapped = true;
      sendEvent(collectPayload("page_view"), true);
    }
  }

  const client: WhoVisitClient = {
    version: "0.2.0",

    async init(options) {
      await init(options);
    },

    getConfig() {
      return apiFetch("/v1/site/config") as Promise<SiteConfig>;
    },

    configure(patch) {
      return apiFetch("/v1/site/config", {
        method: "PATCH",
        body: JSON.stringify(patch),
      }) as Promise<SiteConfig>;
    },

    async register(id?: string) {
      const res = (await fetch(`${apiBase}/v1/site/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { siteId: id } : {}),
      }).then((r) => r.json())) as { siteId: string; apiKey: string };
      siteId = res.siteId;
      apiKey = res.apiKey;
      sessionStorage.setItem(KEY_STORAGE(siteId), apiKey);
      return res;
    },

    rotateKey() {
      return apiFetch("/v1/site/rotate-key", { method: "POST" }) as Promise<{
        siteId: string;
        apiKey: string;
      }>;
    },

    track(event, data) {
      sendEvent(collectPayload(event, data));
    },

    conversion(data) {
      sendEvent(collectPayload("conversion", data));
    },

    createLink(input) {
      return apiFetch("/v1/site/links", {
        method: "POST",
        body: JSON.stringify(input),
      }) as Promise<{ id: string; url: string }>;
    },

    listLinks() {
      return apiFetch("/v1/site/links") as Promise<{
        links: Array<{
          id: string;
          url: string;
          targetUrl: string;
          hits: number | null;
          label: string | null;
          sourcePlatform: string | null;
        }>;
      }>;
    },

    getSummary() {
      return apiFetch(`/v1/analytics/${encodeURIComponent(siteId)}/summary`);
    },
  };

  if (bootstrap?.siteId) {
    void client.init(bootstrap);
  }

  return client;
}
