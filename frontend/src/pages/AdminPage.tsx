import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

import { apiGet, apiDelete, apiPost, ApiStatsResponse, ApiCachedResponse } from "../lib/api";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { StatCard } from "../components/StatCard";
import { ScrollReveal } from "../components/ScrollReveal";
import { useToast } from "../contexts/ToastContext";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const rowVariants = {
  initial: { opacity: 0, x: -8 },
  animate: (i: number) => ({
    opacity: 1, x: 0,
    transition: { duration: 0.18, delay: Math.min(i * 0.02, 0.3) },
  }),
  exit: { opacity: 0, x: 16, transition: { duration: 0.15 } },
};

type Ecosystem = "python" | "npm" | "nuget" | "docker";

const ECOSYSTEMS: { id: Ecosystem; label: string; accentVar: string; color: string }[] = [
  { id: "python", label: "Python", accentVar: "--eco-python", color: "hsl(243, 75%, 59%)" },
  { id: "npm",    label: "npm",    accentVar: "--eco-npm",    color: "hsl(0, 76%, 51%)" },
  { id: "nuget",  label: "NuGet",  accentVar: "--eco-nuget",  color: "hsl(208, 100%, 30%)" },
  { id: "docker", label: "Docker", accentVar: "--eco-docker", color: "hsl(210, 85%, 55%)" },
];

// Tiny ecosystem icon for cache list rows
function EcoIcon({ eco }: { eco: Ecosystem }) {
  if (eco === "python") return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"
      style={{ color: "hsl(var(--eco-python))", opacity: 0.5, flexShrink: 0 }}>
      <path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.007 2.752h5.814v.826H3.89S0 5.789 0 11.969c0 6.18 3.403 5.96 3.403 5.96h2.031v-2.867s-.11-3.404 3.347-3.404h5.765s3.236.052 3.236-3.128V3.128S18.28 0 11.914 0zM8.708 1.81a1.044 1.044 0 1 1 0 2.086 1.044 1.044 0 0 1 0-2.086z"/>
      <path d="M12.086 24c6.094 0 5.714-2.656 5.714-2.656l-.007-2.752H12v-.826h8.11S24 18.211 24 12.031c0-6.18-3.403-5.96-3.403-5.96h-2.031v2.867s.11 3.404-3.347 3.404H9.454s-3.236-.052-3.236 3.128v5.402S5.72 24 12.086 24zm3.206-1.81a1.044 1.044 0 1 1 0-2.086 1.044 1.044 0 0 1 0 2.086z"/>
    </svg>
  );
  if (eco === "npm") return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"
      style={{ color: "hsl(var(--eco-npm))", opacity: 0.5, flexShrink: 0 }}>
      <path d="M0 0v24h24V0H0zm6 18H4V6h2v12zm4-6H8V6h8v12h-4v-6h-2v6z"/>
    </svg>
  );
  if (eco === "nuget") return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"
      style={{ color: "hsl(var(--eco-nuget))", opacity: 0.5, flexShrink: 0 }}>
      <path d="M19.765 6.782L12 2.25 4.235 6.782v9.064L12 20.378l7.765-4.532V6.782zm-7.765 9.544l-5.765-3.364V8.3L12 4.936l5.765 3.364v4.662L12 16.326z"/>
    </svg>
  );
  // docker
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"
      style={{ color: "hsl(var(--eco-docker))", opacity: 0.5, flexShrink: 0 }}>
      <path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.186.186 0 0 0-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.186.186 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.185.186v1.887c0 .102.083.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/>
    </svg>
  );
}

function CacheList({
  packages, loading, stats, ecosystem, onDelete, onClearAll, onRefresh,
}: {
  packages: string[]; loading: boolean; stats?: ApiStatsResponse;
  ecosystem: Ecosystem; onDelete: (name: string) => void;
  onClearAll: () => void; onRefresh: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [deleting, setDeletingLocal] = useState<string | null>(null);
  const [shakeTarget, setShakeTarget] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const { toast } = useToast();

  const filtered = filter.trim()
    ? packages.filter((p) => p.toLowerCase().includes(filter.trim().toLowerCase()))
    : packages;

  const handleDelete = async (name: string) => {
    setDeletingLocal(name);
    try {
      await onDelete(name);
    } catch {
      setShakeTarget(name);
      setTimeout(() => setShakeTarget(null), 500);
    } finally {
      setDeletingLocal(null);
    }
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    setConfirmClear(false);
    onClearAll();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="text-sm font-medium">
          Cached{packages.length > 0 ? ` (${packages.length})` : ""}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className="h-8 w-full sm:w-auto rounded-lg border border-border bg-input px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <motion.button
            onClick={onRefresh}
            className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card/40 text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.35 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
          </motion.button>
          <motion.button
            onClick={handleClear}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className={`h-8 rounded-lg border px-3 text-xs font-medium transition-colors ${
              confirmClear
                ? "border-destructive bg-destructive text-destructive-foreground"
                : "border-border bg-card/40 text-muted-foreground hover:text-destructive hover:border-destructive/40"
            }`}
          >
            {confirmClear ? "Confirm?" : "Clear all"}
          </motion.button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          {packages.length === 0 ? "No packages cached yet." : `No packages match "${filter}".`}
        </motion.div>
      ) : (
        <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
          <AnimatePresence>
            {filtered.map((name, i) => (
              <motion.div
                key={name}
                custom={i}
                variants={shakeTarget === name ? undefined : rowVariants}
                initial={shakeTarget === name ? false : "initial"}
                animate={shakeTarget === name
                  ? { x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.4 } }
                  : "animate"}
                exit="exit"
                className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <EcoIcon eco={ecosystem} />
                  <span className="font-mono text-sm truncate">{name}</span>
                  {ecosystem === "python" && stats?.download_counts?.[name] ? (
                    <span className="flex-shrink-0 text-xs text-muted-foreground">
                      {stats.download_counts[name]} dl
                    </span>
                  ) : null}
                </div>
                <motion.button
                  onClick={() => void handleDelete(name)}
                  disabled={deleting === name}
                  className="flex-shrink-0 flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-destructive/40 hover:text-destructive transition-colors disabled:opacity-50"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {deleting === name ? (
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  )}
                  Delete
                </motion.button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [ecoTab, setEcoTab] = useState<Ecosystem>("python");

  const statsQ = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => apiGet<ApiStatsResponse>("/api/stats"),
    refetchInterval: 10_000,
  });

  const cachedQ = useQuery({
    queryKey: ["admin", "cached", "python"],
    queryFn: () => apiGet<ApiCachedResponse>("/api/cached"),
  });
  const npmCachedQ = useQuery({
    queryKey: ["admin", "cached", "npm"],
    queryFn: () => apiGet<ApiCachedResponse>("/api/npm/cached"),
  });
  const nugetCachedQ = useQuery({
    queryKey: ["admin", "cached", "nuget"],
    queryFn: () => apiGet<ApiCachedResponse>("/api/nuget/cached"),
  });
  const dockerCachedQ = useQuery({
    queryKey: ["admin", "cached", "docker"],
    queryFn: () => apiGet<{ images: string[] }>("/api/docker/cached").then((r) => ({ packages: r.images })),
  });

  const stats = statsQ.data;

  const handleRefreshIndex = async () => {
    try {
      await apiPost<{ status: string }>("/api/simple/refresh");
      toast("Simple index refreshed", "success");
    } catch (e) {
      toast(`Failed: ${e}`, "error");
    }
  };

  const handlePythonDelete = async (name: string) => {
    try {
      await apiDelete(`/api/cache/${encodeURIComponent(name)}`);
      toast(`Deleted cache for ${name}`, "success");
      void queryClient.invalidateQueries({ queryKey: ["admin", "cached", "python"] });
    } catch (e) { toast(`Failed to delete ${name}: ${e}`, "error"); throw e; }
  };
  const handlePythonClearAll = async () => {
    try {
      await apiDelete("/api/cache");
      toast("Python cache cleared", "success");
      void queryClient.invalidateQueries({ queryKey: ["admin", "cached", "python"] });
    } catch (e) { toast(`Failed: ${e}`, "error"); }
  };

  const handleNpmDelete = async (name: string) => {
    try {
      await apiDelete(`/api/npm/cache/${encodeURIComponent(name)}`);
      toast(`Deleted npm cache for ${name}`, "success");
      void queryClient.invalidateQueries({ queryKey: ["admin", "cached", "npm"] });
    } catch (e) { toast(`Failed to delete ${name}: ${e}`, "error"); throw e; }
  };
  const handleNpmClearAll = async () => {
    try {
      await apiDelete("/api/npm/cache");
      toast("npm cache cleared", "success");
      void queryClient.invalidateQueries({ queryKey: ["admin", "cached", "npm"] });
    } catch (e) { toast(`Failed: ${e}`, "error"); }
  };

  const handleNugetDelete = async (name: string) => {
    try {
      await apiDelete(`/api/nuget/cache/${encodeURIComponent(name)}`);
      toast(`Deleted NuGet cache for ${name}`, "success");
      void queryClient.invalidateQueries({ queryKey: ["admin", "cached", "nuget"] });
    } catch (e) { toast(`Failed to delete ${name}: ${e}`, "error"); throw e; }
  };
  const handleNugetClearAll = async () => {
    try {
      await apiDelete("/api/nuget/cache");
      toast("NuGet cache cleared", "success");
      void queryClient.invalidateQueries({ queryKey: ["admin", "cached", "nuget"] });
    } catch (e) { toast(`Failed: ${e}`, "error"); }
  };

  const handleDockerDelete = async (name: string) => {
    try {
      await apiDelete(`/api/docker/cache/${encodeURIComponent(name)}`);
      toast(`Deleted Docker cache for ${name}`, "success");
      void queryClient.invalidateQueries({ queryKey: ["admin", "cached", "docker"] });
    } catch (e) { toast(`Failed to delete ${name}: ${e}`, "error"); throw e; }
  };
  const handleDockerClearAll = async () => {
    try {
      await apiDelete("/api/docker/cache");
      toast("Docker cache cleared", "success");
      void queryClient.invalidateQueries({ queryKey: ["admin", "cached", "docker"] });
    } catch (e) { toast(`Failed: ${e}`, "error"); }
  };

  const pythonPkgs = cachedQ.data?.packages ?? [];
  const npmPkgs = npmCachedQ.data?.packages ?? [];
  const nugetPkgs = nugetCachedQ.data?.packages ?? [];
  const dockerPkgs = dockerCachedQ.data?.packages ?? [];

  const topDownloads = stats?.top_downloads ?? [];
  const maxDownloads = topDownloads.reduce((m, d) => Math.max(m, d.count), 1);

  return (
    <div>
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
          <div className="mt-1 text-sm text-muted-foreground">Cache management and download statistics.</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button variant="secondary" onClick={handleRefreshIndex}>
              Refresh PyPI Index
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Stats */}
      <ScrollReveal className="mt-6">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          {statsQ.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card/40 p-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-7 w-16" />
              </div>
            ))
          ) : (
            <>
              <StatCard index={0} label="Python cached" value={String(pythonPkgs.length)} color="hsl(var(--eco-python))" />
              <StatCard index={1} label="npm cached" value={String(npmPkgs.length)} color="hsl(var(--eco-npm))" />
              <StatCard index={2} label="NuGet cached" value={String(nugetPkgs.length)} color="hsl(var(--eco-nuget))" />
              <StatCard index={3} label="Docker cached" value={String(dockerPkgs.length)} color="hsl(var(--eco-docker))" />
              <StatCard index={4} label="Uptime" value={formatUptime(stats?.uptime_seconds ?? 0)} />
            </>
          )}
        </div>
      </ScrollReveal>

      {/* Top downloads with bar visualization */}
      <AnimatePresence>
        {topDownloads.length > 0 && (
          <motion.div
            className="mt-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.25 }}
          >
            <div className="text-sm font-medium mb-3">Top downloads (this session)</div>
            <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
              {topDownloads.map((item, i) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-4 px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <span className="text-xs text-muted-foreground w-5 flex-shrink-0 text-right">{i + 1}</span>
                  <span className="font-mono text-xs min-w-[100px]">{item.name}</span>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: "hsl(var(--eco-python)/0.6)" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.count / maxDownloads) * 100}%` }}
                        transition={{ duration: 0.5, delay: i * 0.05 }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground flex-shrink-0 w-8 text-right">{item.count}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ecosystem tabs + cache list */}
      <motion.div
        className="mt-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.3 }}
      >
        {/* Ecosystem tab bar */}
        <div className="flex gap-0 border-b border-border mb-4">
          {ECOSYSTEMS.map((eco) => (
            <button
              key={eco.id}
              onClick={() => setEcoTab(eco.id)}
              className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                ecoTab === eco.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              style={ecoTab === eco.id ? { color: eco.color } : {}}
            >
              {eco.label}
              {ecoTab === eco.id && (
                <motion.div
                  layoutId="admin-eco-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: eco.color }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={ecoTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {ecoTab === "python" && (
              <CacheList packages={pythonPkgs} loading={cachedQ.isLoading} stats={stats} ecosystem="python"
                onDelete={handlePythonDelete} onClearAll={handlePythonClearAll}
                onRefresh={() => void queryClient.invalidateQueries({ queryKey: ["admin", "cached", "python"] })} />
            )}
            {ecoTab === "npm" && (
              <CacheList packages={npmPkgs} loading={npmCachedQ.isLoading} ecosystem="npm"
                onDelete={handleNpmDelete} onClearAll={handleNpmClearAll}
                onRefresh={() => void queryClient.invalidateQueries({ queryKey: ["admin", "cached", "npm"] })} />
            )}
            {ecoTab === "nuget" && (
              <CacheList packages={nugetPkgs} loading={nugetCachedQ.isLoading} ecosystem="nuget"
                onDelete={handleNugetDelete} onClearAll={handleNugetClearAll}
                onRefresh={() => void queryClient.invalidateQueries({ queryKey: ["admin", "cached", "nuget"] })} />
            )}
            {ecoTab === "docker" && (
              <CacheList packages={dockerPkgs} loading={dockerCachedQ.isLoading} ecosystem="docker"
                onDelete={handleDockerDelete} onClearAll={handleDockerClearAll}
                onRefresh={() => void queryClient.invalidateQueries({ queryKey: ["admin", "cached", "docker"] })} />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
