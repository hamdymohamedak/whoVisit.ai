import { createWhoVisitClient, type WhoVisitInitOptions } from "./client";

(function () {
  const script =
    document.currentScript ||
    (document.querySelector('script[data-site]') as HTMLScriptElement | null);

  const injected = (window as Window & { __WHOVISIT_CONFIG__?: WhoVisitInitOptions })
    .__WHOVISIT_CONFIG__;

  const fromScript: WhoVisitInitOptions = {
    siteId: injected?.siteId ?? script?.getAttribute("data-site") ?? "",
    apiKey: injected?.apiKey ?? script?.getAttribute("data-key") ?? undefined,
    apiBase:
      injected?.apiBase ??
      script?.getAttribute("data-api") ??
      (script?.src ? new URL(script.src).origin.replace(/\/v1\.js$/, "") : ""),
    autoTrack:
      injected?.autoTrack ?? script?.getAttribute("data-auto-track") !== "false",
    notify: injected?.notify ?? {
      aiOnly: script?.getAttribute("data-notify-ai-only") === "true",
      minConfidence:
        (script?.getAttribute("data-notify-min-confidence") as
          | "low"
          | "medium"
          | "high"
          | null) ?? undefined,
    },
    integrations: injected?.integrations ?? {
      discordWebhook: script?.getAttribute("data-discord-webhook") || undefined,
      telegramBotToken: script?.getAttribute("data-telegram-bot-token") || undefined,
      telegramChatId: script?.getAttribute("data-telegram-chat-id") || undefined,
    },
  };

  if (!fromScript.siteId) {
    console.warn(
      "[WhoVisit] missing site — use embed.js from backend or data-site on script"
    );
    (window as Window & { WhoVisit?: ReturnType<typeof createWhoVisitClient> }).WhoVisit =
      createWhoVisitClient();
    return;
  }

  if (!fromScript.apiBase) {
    fromScript.apiBase = "http://localhost:8787";
  }

  const client = createWhoVisitClient(fromScript);
  (window as Window & { WhoVisit?: typeof client }).WhoVisit = client;

  let lastPath = location.pathname + location.search;
  new MutationObserver(() => {
    const path = location.pathname + location.search;
    if (path !== lastPath) {
      lastPath = path;
      client.track("navigation");
    }
  }).observe(document.documentElement, { subtree: true, childList: true });

  window.addEventListener("popstate", () => client.track("navigation"));
})();
