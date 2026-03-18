import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiGet } from "../lib/api";
import { useSearchHistory } from "../hooks/useSearchHistory";
import { PackageListItem } from "../components/PackageListItem";
import { staggerContainer, staggerItem } from "../lib/motion";

const ACCENT = "hsl(var(--eco-nuget))";
const QUICK = ["Newtonsoft.Json", "Serilog", "Dapper", "AutoMapper", "FluentValidation", "xunit", "Moq", "Bogus"];

type NugetResult = { id: string; version: string; description: string; authors: string; totalDownloads?: number };
type NugetSearchResponse = {
  q: string; skip: number; take: number; totalHits: number;
  results: NugetResult[]; hasMore: boolean;
};

function formatDownloads(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function NugetSearchPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { history, addQuery, removeQuery } = useSearchHistory("nuget_search_history");

  const { data: cachedData } = useQuery({
    queryKey: ["nuget", "cached"],
    queryFn: () => apiGet<{ packages: string[] }>("/api/nuget/cached"),
    staleTime: 30_000,
  });
  const cachedSet = new Set((cachedData?.packages ?? []).map((p) => p.toLowerCase()));

  const searchQ = useInfiniteQuery({
    queryKey: ["nuget", "search", query],
    enabled: query.trim().length > 0,
    initialPageParam: 0,
    queryFn: ({ pageParam = 0 }) =>
      apiGet<NugetSearchResponse>(`/api/nuget/search?q=${encodeURIComponent(query)}&skip=${pageParam}&take=20`),
    getNextPageParam: (last, pages) => last.hasMore ? pages.length * 20 : undefined,
  });

  const results = searchQ.data?.pages.flatMap((p) => p.results) ?? [];
  const pages = searchQ.data?.pages ?? [];
  const hasMore = pages[pages.length - 1]?.hasMore ?? false;

  const handleInput = (val: string) => {
    setQ(val);
    setFocusedIdx(-1);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setQuery(""); return; }
    debounceRef.current = setTimeout(() => {
      setQuery(val.trim());
      addQuery(val.trim());
    }, 300);
  };

  const applyQuery = (val: string) => {
    setQ(val);
    setQuery(val);
    setFocusedIdx(-1);
    if (val.trim()) addQuery(val.trim());
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusedIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter" && focusedIdx >= 0 && results[focusedIdx]) {
      navigate(`/nuget/package/${encodeURIComponent(results[focusedIdx].id)}`);
    } else if (e.key === "Escape") { setQ(""); setQuery(""); setFocusedIdx(-1); }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <motion.div
        className="rounded-2xl border border-border bg-card/40 p-5 sm:p-6 mb-5"
        style={{}}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: ACCENT }}>
            <path d="M19.765 6.782L12 2.25 4.235 6.782v9.064L12 20.378l7.765-4.532V6.782zm-7.765 9.544l-5.765-3.364V8.3L12 4.936l5.765 3.364v4.662L12 16.326z"/>
          </svg>
          <span className="font-semibold text-base tracking-tight">NuGet</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `hsl(var(--eco-nuget)/0.12)`, color: ACCENT }}>
            registry proxy
          </span>
        </div>

        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search NuGet packages…"
            className="h-12 w-full rounded-xl border border-border bg-background/80 pl-10 pr-16 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-shadow"
            style={{ "--tw-ring-color": "hsl(var(--eco-nuget)/0.35)" } as React.CSSProperties}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {q && (
              <button onClick={() => { setQ(""); setQuery(""); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1">✕</button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <span>⌘</span><span>K</span>
            </kbd>
          </div>
        </div>

        <AnimatePresence>
          {!query && history.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
              <div className="mt-3 flex flex-wrap gap-1.5">
                {history.map((h) => (
                  <span key={h} className="group flex items-center gap-0.5 rounded-full border border-border bg-muted/40 pl-2.5 pr-1 py-0.5">
                    <button onClick={() => applyQuery(h)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{h}</button>
                    <button onClick={() => removeQuery(h)} className="w-4 h-4 flex items-center justify-center text-muted-foreground/50 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all">×</button>
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!query && (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-0.5">
            <span className="text-xs text-muted-foreground flex-shrink-0">Popular:</span>
            {QUICK.map((pkg) => (
              <button key={pkg} onClick={() => applyQuery(pkg)}
                className="flex-shrink-0 rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
                {pkg}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── Results ───────────────────────────────────────────────────── */}
      {searchQ.isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[116px] rounded-2xl border border-border bg-card/40 animate-pulse" />
          ))}
        </div>
      )}

      {!searchQ.isLoading && query && results.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium">No NuGet packages found for &ldquo;{query}&rdquo;</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {QUICK.map((s) => (
              <button key={s} onClick={() => applyQuery(s)}
                className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
                {s}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {results.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-3 px-1">
            {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
          </div>
          <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            variants={staggerContainer(0.03)}
            initial="hidden"
            animate="visible"
          >
            {results.map((r, i) => (
              <motion.div key={r.id} variants={staggerItem} className="h-full">
                <PackageListItem
                  name={r.id}
                  version={r.version}
                  description={r.description}
                  to={`/nuget/package/${encodeURIComponent(r.id)}`}
                  ecosystem="nuget"
                  cached={cachedSet.has(r.id.toLowerCase())}
                  focused={focusedIdx === i}
                  meta={
                    r.totalDownloads ? (
                      <span className="text-[11px] text-muted-foreground">↓ {formatDownloads(r.totalDownloads)}</span>
                    ) : undefined
                  }
                />
              </motion.div>
            ))}
          </motion.div>

          {hasMore && (
            <div className="mt-4 text-center">
              <button
                onClick={() => void searchQ.fetchNextPage()}
                disabled={searchQ.isFetchingNextPage}
                className="rounded-xl border border-border bg-card/40 px-5 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {searchQ.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
