import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { apiGet, type ExtensionInfo, type ExtensionVersionsResponse } from "../lib/api";
import { VsixInstallBox } from "../components/VsixInstallBox";

const ACCENT = "hsl(var(--eco-vscode))";

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
    staleTime: 60_000,
    queryFn: () => apiGet<ExtensionInfo>(`/api/extensions/${publisher}/${name}`),
  });

  const versionsQ = useQuery({
    queryKey: ["extensions", "versions", id],
    enabled: Boolean(publisher && name),
    staleTime: 60_000,
    queryFn: () => apiGet<ExtensionVersionsResponse>(`/api/extensions/${publisher}/${name}/versions`),
  });

  if (detailQ.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 rounded bg-muted animate-pulse" />
        <div className="h-32 rounded-2xl border border-border bg-card/40 animate-pulse" />
        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 h-64 rounded-2xl border border-border bg-card/40 animate-pulse" />
          <div className="lg:col-span-3 h-64 rounded-2xl border border-border bg-card/40 animate-pulse" />
        </div>
      </div>
    );
  }

  if (detailQ.isError || !detailQ.data) return <div className="text-sm text-muted-foreground">Extension not found.</div>;

  const ext = detailQ.data;
  const versions = versionsQ.data?.versions ?? ext.versions ?? [];
  const latest = versions[0]?.version ?? "latest";

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      {/* Breadcrumbs */}
      <div className="text-sm text-muted-foreground">
        <Link to="/extensions" className="hover:text-foreground transition-colors">Extensions</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">{ext.publisher}.{ext.name}</span>
      </div>

      {/* Header card */}
      <div className="rounded-2xl border border-border bg-card/50 p-5">
        <div className="flex items-start gap-3">
          {ext.logoUrl ? (
            <img src={ext.logoUrl} alt={`${id} logo`} className="w-14 h-14 rounded-xl border border-border object-cover" loading="lazy" />
          ) : (
            <div
              className="w-14 h-14 rounded-xl border border-border flex items-center justify-center font-bold text-xl select-none"
              style={{ backgroundColor: "hsl(var(--eco-vscode)/0.12)", color: ACCENT }}
            >
              {ext.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">{ext.displayName || ext.name}</h1>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{ext.publisher}.{ext.name}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <span className="flex items-center gap-1">★ {ext.rating.toFixed(1)} <span className="opacity-60">({ext.ratingCount})</span></span>
              <span>↓ {formatInstalls(ext.installs)}</span>
              <span
                className="px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                style={{ backgroundColor: "hsl(var(--eco-vscode)/0.12)", color: ACCENT }}
              >
                {(ext.builtInInstallSource ?? "openvsx").toUpperCase()}
              </span>
              {ext.verified && <span className="px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-[10px]">verified</span>}
            </div>
          </div>
        </div>
        {ext.description && <p className="mt-3 text-sm text-muted-foreground">{ext.description}</p>}
      </div>

      {/* Install + Versions grid */}
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
              {versions.map((v, i) => (
                <motion.div
                  key={v.version}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.15 }}
                  className="rounded-xl border border-border p-2.5 text-xs hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium">{v.version}</span>
                    <a
                      href={v.vsixAssetPath}
                      className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      VSIX
                    </a>
                  </div>
                  {v.lastUpdated && <div className="text-muted-foreground mt-1">{new Date(v.lastUpdated).toLocaleString()}</div>}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
