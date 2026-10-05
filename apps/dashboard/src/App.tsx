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
};

export function App() {
  const [siteId, setSiteId] = useState(
    () => localStorage.getItem("wv_site") || "site_demo"
  );
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    localStorage.setItem("wv_site", siteId);
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
  }, [siteId]);

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
