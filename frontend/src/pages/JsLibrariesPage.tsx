import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { buildJsProxyUrl, getJsHealth, getJsStats, type JsHealthResponse } from "../lib/api";

const ACCENT = "hsl(var(--eco-js))";
const EXAMPLE = "https://jsuites.net/v4/jsuites.js";

export default function JsLibrariesPage() {
  const [url, setUrl] = useState(EXAMPLE);
  const [health, setHealth] = useState<JsHealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proxyLink = useMemo(() => buildJsProxyUrl(url), [url]);

  const statsQ = useQuery({
    queryKey: ["js", "stats"],
    queryFn: getJsStats,
    refetchInterval: 10_000,
  });

  const onHealthCheck = async () => {
    setError(null);
    setHealth(null);
    setHealthLoading(true);
    try {
      const result = await getJsHealth(url);
      setHealth(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Health check failed";
      setError(msg);
    } finally {
      setHealthLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card/40 p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-muted/60 text-[11px] font-bold">JS</span>
          <span className="font-semibold tracking-tight">JS Libraries Proxy</span>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "hsl(var(--eco-js)/0.12)", color: ACCENT }}
          >
            universal url proxy
          </span>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Вставьте URL JS-файла и получите локальную прокси-ссылку через ваш сервер.
        </p>

        <div className="space-y-3">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background/80 px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2"
            style={{ "--tw-ring-color": "hsl(var(--eco-js)/0.35)" } as React.CSSProperties}
            placeholder="https://cdn.example.com/library.min.js"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onHealthCheck}
              disabled={healthLoading}
              className="rounded-xl border border-border bg-card/60 px-4 py-2 text-sm hover:bg-card transition-colors disabled:opacity-60"
            >
              {healthLoading ? "Checking..." : "Check availability"}
            </button>
            <a
              href={proxyLink}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-border bg-card/60 px-4 py-2 text-sm hover:bg-card transition-colors"
            >
              Open proxied JS
            </a>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-background/60 p-3">
          <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Proxy URL</div>
          <code className="block break-all text-xs">{proxyLink}</code>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {health && (
          <div className="mt-3 rounded-xl border border-border bg-background/60 p-3 text-sm">
            <div className="font-medium">
              Status:{" "}
              <span style={{ color: health.ok ? "hsl(142 72% 50%)" : "hsl(0 84% 70%)" }}>
                {health.ok ? "OK" : "FAILED"}
              </span>
            </div>
            <div className="mt-1 text-muted-foreground">HTTP: {health.status_code ?? "n/a"}</div>
            <div className="text-muted-foreground">Content-Type: {health.content_type ?? "n/a"}</div>
            {health.message ? <div className="text-muted-foreground">Message: {health.message}</div> : null}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card/40 p-5 sm:p-6">
        <div className="mb-3 font-semibold tracking-tight">Proxy analytics</div>
        {statsQ.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading stats...</div>
        ) : statsQ.isError ? (
          <div className="text-sm text-red-300">Failed to load stats</div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <Stat label="Total requests" value={String(statsQ.data?.total_proxy_requests ?? 0)} />
              <Stat label="Unique URLs" value={String(statsQ.data?.unique_urls ?? 0)} />
              <Stat label="Unique domains" value={String(statsQ.data?.unique_domains ?? 0)} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Top domains</div>
                <ul className="space-y-1 text-sm">
                  {(statsQ.data?.top_domains ?? []).slice(0, 8).map((row) => (
                    <li key={row.domain} className="flex items-center justify-between gap-2">
                      <span className="truncate">{row.domain}</span>
                      <span className="text-muted-foreground">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-border bg-background/60 p-3">
                <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Top URLs</div>
                <ul className="space-y-1 text-sm">
                  {(statsQ.data?.top_urls ?? []).slice(0, 8).map((row) => (
                    <li key={row.url} className="flex items-center justify-between gap-2">
                      <span className="truncate">{row.url}</span>
                      <span className="text-muted-foreground">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
