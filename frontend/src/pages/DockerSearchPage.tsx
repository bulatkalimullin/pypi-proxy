import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiGet } from "../lib/api";
import { useSearchHistory } from "../hooks/useSearchHistory";
import { PackageListItem } from "../components/PackageListItem";
import { staggerContainer, staggerItem } from "../lib/motion";

const ACCENT = "hsl(var(--eco-docker))";
const QUICK = ["nginx", "postgres", "redis", "node", "alpine", "python", "ubuntu", "mysql"];

type DockerSearchResult = {
  name: string;
  description: string;
  is_official: boolean;
  is_automated: boolean;
  stars: number;
  pulls: number;
};

type DockerSearchResponse = {
  q: string; page: number;
  results: DockerSearchResult[];
  hasMore?: boolean; nextPage?: number | null;
};

type DockerCachedResponse = { images: string[] };

function formatPulls(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function DockerSearchPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { history, addQuery, removeQuery } = useSearchHistory("docker_search_history");

  const { data: cachedData } = useQuery({
    queryKey: ["docker", "cached"],
    queryFn: () => apiGet<DockerCachedResponse>("/api/docker/cached"),
    staleTime: 30_000,
  });
  const cachedSet = new Set(cachedData?.images ?? []);

  const searchQ = useInfiniteQuery({
    queryKey: ["docker", "search", query],
    enabled: query.trim().length > 0,
    initialPageParam: 1,
    queryFn: ({ pageParam = 1 }) =>
      apiGet<DockerSearchResponse>(`/api/docker/search?q=${encodeURIComponent(query)}&page=${pageParam}`),
    getNextPageParam: (last) => last.nextPage ?? undefined,
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
      const r = results[focusedIdx];
      const imageName = r.name.includes("/") ? r.name : `library/${r.name}`;
      navigate(`/docker/image/${imageName}`);
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
            <path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.186.186 0 0 0-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.186.186 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.185.186v1.887c0 .102.083.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/>
          </svg>
          <span className="font-semibold text-base tracking-tight">Docker</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `hsl(var(--eco-docker)/0.12)`, color: ACCENT }}>
            pull-through cache
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
            placeholder="Search Docker images…"
            className="h-12 w-full rounded-xl border border-border bg-background/80 pl-10 pr-16 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-shadow"
            style={{ "--tw-ring-color": "hsl(var(--eco-docker)/0.35)" } as React.CSSProperties}
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
            {QUICK.map((img) => (
              <button key={img} onClick={() => applyQuery(img)}
                className="flex-shrink-0 rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
                {img}
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
          <p className="text-sm font-medium">No Docker images found for &ldquo;{query}&rdquo;</p>
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
            {results.length} image{results.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
          </div>
          <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            variants={staggerContainer(0.03)}
            initial="hidden"
            animate="visible"
          >
            {results.map((r, i) => {
              const imageName = r.name.includes("/") ? r.name : `library/${r.name}`;
              return (
                <motion.div key={r.name} variants={staggerItem} className="h-full">
                  <PackageListItem
                    name={r.name}
                    description={r.description}
                    to={`/docker/image/${imageName}`}
                    ecosystem="docker"
                    cached={cachedSet.has(imageName)}
                    focused={focusedIdx === i}
                    meta={
                      <div className="flex items-center gap-2">
                        {r.is_official && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: `hsl(var(--eco-docker)/0.12)`, color: ACCENT }}>
                            official
                          </span>
                        )}
                        {r.pulls > 0 && (
                          <span className="text-[11px] text-muted-foreground">↓ {formatPulls(r.pulls)}</span>
                        )}
                        {r.stars > 0 && (
                          <span className="text-[11px] text-muted-foreground">★ {r.stars.toLocaleString()}</span>
                        )}
                      </div>
                    }
                  />
                </motion.div>
              );
            })}
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
