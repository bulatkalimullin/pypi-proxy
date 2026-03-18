import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { apiGet, PyPIVersionJson } from "../lib/api";
import { Skeleton } from "../components/ui/skeleton";

function backendBaseUrl(): string {
  const u = new URL(window.location.href);
  u.port = "8888";
  u.pathname = "";
  u.search = "";
  u.hash = "";
  return u.toString().replace(/\/$/, "");
}

export default function VersionPage() {
  const params = useParams();
  const name = params.name ? decodeURIComponent(params.name) : "";
  const version = params.version ? decodeURIComponent(params.version) : "";

  const q = useQuery({
    queryKey: ["version", name, version],
    enabled: !!name && !!version,
    queryFn: () => apiGet<PyPIVersionJson>(`/api/package/${encodeURIComponent(name)}/${encodeURIComponent(version)}`),
    staleTime: 60_000,
  });

  const info = q.data?.info ?? {};
  const urls = q.data?.urls ?? [];

  return (
    <div>
      <div className="text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Search
        </Link>{" "}
        /{" "}
        <Link to={`/package/${encodeURIComponent(name)}`} className="hover:text-foreground">
          {name}
        </Link>{" "}
        / <span className="text-foreground">{version}</span>
      </div>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{version}</h1>
          {info.summary ? <div className="mt-1 text-sm text-muted-foreground">{info.summary}</div> : null}
        </div>
        <Link
          to={`/package/${encodeURIComponent(name)}`}
          className="rounded-lg border border-border bg-card/40 px-4 py-2 text-sm hover:bg-card/60"
        >
          All versions
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card/40 p-4">
            <div className="text-sm font-medium">Files</div>

            {q.isLoading ? (
              <div className="mt-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : q.isError ? (
              <div className="mt-3 text-sm text-muted-foreground">{String(q.error)}</div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-card/60 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Filename</th>
                      <th className="px-4 py-3 text-left font-medium">Type</th>
                      <th className="px-4 py-3 text-right font-medium">Size</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {urls.map((u) => (
                      <tr key={u.filename ?? Math.random()} className="hover:bg-card/60">
                        <td className="px-4 py-3 font-mono text-xs">{u.filename}</td>
                        <td className="px-4 py-3 text-muted-foreground">{u.packagetype}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {typeof u.size === "number" ? `${Math.round(u.size / 1024)} KB` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {u.filename ? (
                            <a
                              className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
                              href={`${backendBaseUrl()}/download/${encodeURIComponent(name)}/${encodeURIComponent(
                                version
                              )}/${encodeURIComponent(u.filename)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Download
                            </a>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="rounded-2xl border border-border bg-card/40 p-4">
            <div className="text-sm font-medium">Metadata</div>
            {q.isLoading ? (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                {info.license ? (
                  <div>
                    <span className="text-muted-foreground">License:</span>{" "}
                    <span className="text-foreground">{info.license}</span>
                  </div>
                ) : null}
                {info.requires_python ? (
                  <div>
                    <span className="text-muted-foreground">Python:</span>{" "}
                    <span className="text-foreground">{info.requires_python}</span>
                  </div>
                ) : null}
                <div>
                  <span className="text-muted-foreground">Backend:</span>{" "}
                  <span className="text-foreground">{backendBaseUrl()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

