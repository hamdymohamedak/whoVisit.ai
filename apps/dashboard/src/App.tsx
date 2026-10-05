import { useCallback, useState } from "react";

type Summary = {
  siteId: string;
  totalEvents: number;
  byCategory: { sourceCategory: string | null; count: number }[];
  aiPlatforms: { platform: string | null; count: number }[];
  aiCrawlers: { botName: string | null; pagePath: string | null; count: number }[];
  aiLandingPages: { path: string | null; count: number }[];
  conversionAttribution: {
    sourcePlatform: string | null;
    sourceCategory: string | null;
    visitors: number;
    signups: number;
    revenue: number;
  }[];
  byCountry: { country: string | null; count: number }[];
  funnelByCategory: {
    sourceCategory: string | null;
    sessions: number;
    conversions: number;
    revenue: number;
  }[];
};

export function App() {
  const [siteId, setSiteId] = useState(
    () => localStorage.getItem("wv_site") || "site_demo"
  );
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("wv_api_key") || ""
  );
  const [summary, setSummary] = useState<Summary | null>(null);
  const [links, setLinks] = useState<
    { id: string; url: string; targetUrl: string; hits: number | null }[]
  >([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://example.com/pricing");
  const [linkPlatform, setLinkPlatform] = useState("chatgpt");

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (siteId) h["X-WhoVisit-Site"] = siteId;
    if (apiKey) h["X-WhoVisit-Key"] = apiKey;
    return h;
  }, [siteId, apiKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    localStorage.setItem("wv_site", siteId);
    localStorage.setItem("wv_api_key", apiKey);
    try {
      const res = await fetch(`/v1/analytics/${encodeURIComponent(siteId)}/summary`);
      if (!res.ok) throw new Error(await res.text());
      setSummary(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [siteId, apiKey]);

  const loadLinks = useCallback(async () => {
    if (!apiKey) return;
    const res = await fetch("/v1/site/links", { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      setLinks(data.links ?? []);
    }
  }, [apiKey, authHeaders]);

  const createLink = async () => {
    const res = await fetch("/v1/site/links", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        targetUrl: linkUrl,
        sourcePlatform: linkPlatform,
      }),
    });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    await loadLinks();
  };

  const registerSite = async () => {
    const res = await fetch("/v1/site/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId }),
    });
    const data = await res.json();
    if (data.apiKey) {
      setApiKey(data.apiKey);
      localStorage.setItem("wv_api_key", data.apiKey);
    }
  };

  const humanAi =
    summary?.aiPlatforms.reduce((a, r) => a + r.count, 0) ?? 0;
  const crawlers =
    summary?.aiCrawlers.reduce((a, r) => a + r.count, 0) ?? 0;

  return (
    <div className="app">
      <header>
        <h1>AI Traffic Intelligence</h1>
        <p className="muted">Analytics for the AI search era — WhoVisit</p>
      </header>

      <div className="toolbar">
        <input
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          placeholder="Site ID (data-site)"
          aria-label="Site ID"
        />
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API key (data-key)"
          aria-label="API key"
          type="password"
        />
        <button type="button" onClick={registerSite}>
          Register / get key
        </button>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {summary && (
        <>
          <div className="grid">
            <div className="card">
              <h2>Visitors (events)</h2>
              <div className="stat-row">
                <span>Total</span>
                <strong>{summary.totalEvents.toLocaleString()}</strong>
              </div>
              {summary.byCategory.map((r) => (
                <div className="stat-row" key={r.sourceCategory ?? "null"}>
                  <span>{r.sourceCategory ?? "unknown"}</span>
                  <span>{r.count.toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="card">
              <h2>AI discovery</h2>
              <div className="stat-row">
                <span>Human AI visits</span>
                <strong>{humanAi.toLocaleString()}</strong>
              </div>
              <div className="stat-row">
                <span>AI crawlers</span>
                <strong>{crawlers.toLocaleString()}</strong>
              </div>
            </div>

            <div className="card">
              <h2>AI sources</h2>
              {summary.aiPlatforms.length === 0 && (
                <p className="muted">No AI traffic yet</p>
              )}
              {summary.aiPlatforms.map((r) => (
                <div className="stat-row" key={r.platform ?? "other"}>
                  <span>{r.platform ?? "Other"}</span>
                  <span>{r.count.toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="card">
              <h2>AI → pages</h2>
              {summary.aiLandingPages.map((r) => (
                <div className="stat-row" key={r.path ?? ""}>
                  <span>{r.path}</span>
                  <span>{r.count}</span>
                </div>
              ))}
            </div>

            <div className="card">
              <h2>Countries (sessions)</h2>
              {(summary.byCountry ?? []).length === 0 && (
                <p className="muted">No geo data yet</p>
              )}
              {(summary.byCountry ?? []).map((r) => (
                <div className="stat-row" key={r.country ?? "unknown"}>
                  <span>{r.country ?? "Unknown"}</span>
                  <span>{r.count}</span>
                </div>
              ))}
            </div>

            <div className="card">
              <h2>Funnel by channel</h2>
              {(summary.funnelByCategory ?? []).map((r) => {
                const rate =
                  r.sessions > 0
                    ? ((r.conversions / r.sessions) * 100).toFixed(1)
                    : "0";
                return (
                  <div className="stat-row" key={r.sourceCategory ?? "?"}>
                    <span>
                      {r.sourceCategory ?? "?"} · {rate}% conv
                    </span>
                    <span>
                      {r.conversions}/{r.sessions}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ marginTop: "1rem" }}>
            <h2>Attribution links</h2>
            <p className="muted">Requires API key — same as WhoVisit.createLink()</p>
            <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
              <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
              <input
                value={linkPlatform}
                onChange={(e) => setLinkPlatform(e.target.value)}
                placeholder="chatgpt"
              />
              <button type="button" onClick={createLink}>
                Create link
              </button>
              <button type="button" onClick={loadLinks}>
                List links
              </button>
            </div>
            {links.map((l) => (
              <div className="stat-row" key={l.id}>
                <span>{l.url}</span>
                <span>{l.hits ?? 0} hits</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: "1rem" }}>
            <h2>Conversion attribution</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr className="muted">
                  <th align="left">Source</th>
                  <th align="right">Visitors</th>
                  <th align="right">Conversions</th>
                  <th align="right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {summary.conversionAttribution.map((r) => (
                  <tr key={`${r.sourceCategory}-${r.sourcePlatform}`}>
                    <td>
                      {r.sourceCategory} / {r.sourcePlatform ?? "—"}
                    </td>
                    <td align="right">{r.visitors}</td>
                    <td align="right">{r.signups}</td>
                    <td align="right">${r.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!summary && !error && (
        <p className="muted">Enter your site ID and refresh to load analytics.</p>
      )}
    </div>
  );
}
