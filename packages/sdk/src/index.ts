(function () {
  const script =
    document.currentScript ||
    (document.querySelector('script[data-site]') as HTMLScriptElement | null);
  if (!script) return;

  const siteId = script.getAttribute("data-site");
  const apiBase =
    script.getAttribute("data-api") ||
    new URL(script.src).origin.replace(/:\d+$/, ":8787");
  const discordWebhook = script.getAttribute("data-discord-webhook") || "";
  const telegramBotToken = script.getAttribute("data-telegram-bot-token") || "";
  const telegramChatId = script.getAttribute("data-telegram-chat-id") || "";

  if (!siteId) {
    console.warn("[WhoVisit] missing data-site");
    return;
  }

  const SESSION_KEY = "wv_sess";
  const sessionId =
    sessionStorage.getItem(SESSION_KEY) ||
    (() => {
      const id = "sess_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      sessionStorage.setItem(SESSION_KEY, id);
      return id;
    })();

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

  function collectPayload(event: string, extra?: Record<string, unknown>) {
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
      device: {
        language: navigator.language,
        screen: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      ...extra,
    };
  }

  function sendEvent(payload: ReturnType<typeof collectPayload>) {
    const body = JSON.stringify(payload);
    const url = `${apiBase}/v1/events`;

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    } else {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  }

  sendEvent(collectPayload("page_view"));

  let lastPath = location.pathname + location.search;
  const observer = new MutationObserver(() => {
    const path = location.pathname + location.search;
    if (path !== lastPath) {
      lastPath = path;
      sendEvent(collectPayload("navigation"));
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true });

  window.addEventListener("popstate", () => {
    sendEvent(collectPayload("navigation"));
  });

  const w = window as Window & {
    WhoVisit?: {
      track: (event: string, data?: Record<string, unknown>) => void;
      conversion: (data?: Record<string, unknown>) => void;
    };
  };

  w.WhoVisit = {
    track(event, data) {
      sendEvent(collectPayload(event, data));
    },
    conversion(data) {
      sendEvent(collectPayload("conversion", data));
    },
  };

  if (discordWebhook || (telegramBotToken && telegramChatId)) {
    fetch(`${apiBase}/v1/notify-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId,
        discordWebhook: discordWebhook || undefined,
        telegramBotToken: telegramBotToken || undefined,
        telegramChatId: telegramChatId || undefined,
      }),
    }).catch(() => {});
  }
})();
