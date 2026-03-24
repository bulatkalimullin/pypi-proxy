import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { apiGet, type ExtensionInfo, type ExtensionVersionsResponse } from "../lib/api";
import { VsixInstallBox } from "../components/VsixInstallBox";

function formatInstalls(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function ExtensionPackagePage() {
  const { publisher = "", name = "" } = useParams();
  const id = `${publisher}.${name}`;

  const detailQ = useQuery({
    queryKey: ["extensions", "detail", id],
    enabled: Boolean(publisher && name),
    queryFn: () => apiGet<ExtensionInfo>(`/api/extensions/${publisher}/${name}`),
  });

  const versionsQ = useQuery({
    queryKey: ["extensions", "versions", id],
    enabled: Boolean(publisher && name),
    queryFn: () => apiGet<ExtensionVersionsResponse>(`/api/extensions/${publisher}/${name}/versions`),
  });

  if (detailQ.isLoading) return <div className="text-sm text-muted-foreground">Loading extension...</div>;
  if (detailQ.isError || !detailQ.data) return <div className="text-sm text-muted-foreground">Extension not found.</div>;

  const ext = detailQ.data;
  const versions = versionsQ.data?.versions ?? ext.versions ?? [];
  const latest = versions[0]?.version ?? "latest";

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link to="/extensions" className="underline">Extensions</Link> / {ext.publisher}.{ext.name}
      </div>
      <div className="rounded-2xl border border-border bg-card/50 p-5">
        <div className="flex items-start gap-3">
          {ext.logoUrl ? (
            <img src={ext.logoUrl} alt={`${id} logo`} className="w-14 h-14 rounded-xl border border-border object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-xl border border-border bg-muted/40" />
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">{ext.displayName || ext.name}</h1>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{ext.publisher}.{ext.name}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span>★ {ext.rating.toFixed(1)} ({ext.ratingCount})</span>
              <span>↓ {formatInstalls(ext.installs)}</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                Built-in install: {(ext.builtInInstallSource ?? "openvsx").toUpperCase()}
              </span>
              {ext.verified && <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">verified</span>}
            </div>
          </div>
        </div>
        {ext.description && <p className="mt-3 text-sm text-muted-foreground">{ext.description}</p>}
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <VsixInstallBox publisher={ext.publisher} name={ext.name} version={latest} />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-border bg-card/40 p-4">
          <h2 className="text-sm font-semibold mb-3">Versions</h2>
          {versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No versions found.</p>
          ) : (
            <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
              {versions.map((v) => (
                <div key={v.version} className="rounded-xl border border-border p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono">{v.version}</span>
                    <a href={v.vsixAssetPath} className="underline text-muted-foreground hover:text-foreground">Download VSIX</a>
                  </div>
                  {v.lastUpdated && <div className="text-muted-foreground mt-1">{new Date(v.lastUpdated).toLocaleString()}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
