import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

import { apiGet, ApiSearchResponse, ApiCachedResponse, PyPIPackageJson } from "../lib/api";
import { usePinnedPackages } from "../hooks/usePinnedPackages";
import { useSearchHistory } from "../hooks/useSearchHistory";
import { PackageConstellation } from "../components/PackageConstellation";
import { PackageListItem } from "../components/PackageListItem";
import { staggerContainer, staggerItem } from "../lib/motion";

const ACCENT = "hsl(var(--eco-python))";
const QUICK = ["requests", "django", "fastapi", "numpy", "flask", "pandas", "sqlalchemy", "pydantic"];

/** Lazy-loads PyPI metadata (version + summary) when card scrolls into view */
function PyPICard({ name, to, cached, focused }: {
  name: string; to: string; cached: boolean; focused: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { rootMargin: "300px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const metaQ = useQuery({
    queryKey: ["pkg-meta", name],
    enabled: visible,
    queryFn: () => apiGet<PyPIPackageJson>(`/api/package/${encodeURIComponent(name)}`),
    staleTime: 5 * 60_000,
  });

  return (
    <div ref={ref} className="h-full">
      <PackageListItem
        name={name}
        to={to}
        ecosystem="python"
        cached={cached}
        focused={focused}
        loading={visible && metaQ.isLoading}
        version={metaQ.data?.info?.version}
        description={metaQ.data?.info?.summary}
      />
    </div>
  );
}

function useDebounce(value: string, ms: number) {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDeb(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return deb;
}

function useIntersection(cb: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) cb(); },
      { rootMargin: "600px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cb]);
  return ref;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const dq = useDebounce(q.trim(), 350);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const { pinned, remove: removePin } = usePinnedPackages();
  const { history, addQuery, removeQuery, clear: clearHistory } = useSearchHistory("python_search_history");

  const cachedQ = useQuery({
    queryKey: ["cached"],
    queryFn: () => apiGet<ApiCachedResponse>("/api/cached"),
    staleTime: 30_000,
  });
  const cachedSet = useMemo(() => new Set(cachedQ.data?.packages ?? []), [cachedQ.data]);

  const searchQ = useInfiniteQuery({
    queryKey: ["search", dq],
    enabled: dq.length > 0,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      apiGet<ApiSearchResponse>(`/api/search?q=${encodeURIComponent(dq)}&page=${pageParam}&limit=50`),
    getNextPageParam: (last) => last.nextPage ?? (last.hasMore ? (last.page ?? 1) + 1 : undefined),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (dq.length > 0 && searchQ.isSuccess) addQuery(dq);
  }, [dq, searchQ.isSuccess, addQuery]);

  const items = useMemo(() => {
    const all = searchQ.data?.pages.flatMap((p) => p.results) ?? [];
    const seen = new Set<string>();
    return all.filter((x) => { if (seen.has(x.name)) return false; seen.add(x.name); return true; });
  }, [searchQ.data]);

  const loadMore = useCallback(() => {
    if (!searchQ.hasNextPage || searchQ.isFetchingNextPage) return;
    void searchQ.fetchNextPage();
  }, [searchQ]);
  const sentinelRef = useIntersection(loadMore);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIdx((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusedIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter" && focusedIdx >= 0 && items[focusedIdx]) {
      navigate(`/package/${encodeURIComponent(items[focusedIdx].name)}`);
    } else if (e.key === "Escape") { setQ(""); setFocusedIdx(-1); }
  };

  const applyQuery = (val: string) => { setQ(val); setFocusedIdx(-1); inputRef.current?.focus(); };

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div>
      {/* ── Hero: ecosystem identity ──────────────────────────────────── */}
      <motion.div
        className="rounded-2xl border border-border bg-card/40 p-5 sm:p-6 mb-5 overflow-hidden relative"
        style={{}}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        {/* PackageConstellation as subtle background (desktop only) */}
        {!isMobile && (
          <div className="absolute inset-0 pointer-events-none opacity-50">
            <PackageConstellation
              query={q}
              cachedPackages={cachedQ.data?.packages}
              className="w-full h-full"
            />
          </div>
        )}

        <div className="relative z-10">
          {/* Identity strip */}
          <div className="flex items-center gap-2 mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: ACCENT }}>
              <path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.007 2.752h5.814v.826H3.89S0 5.789 0 11.969c0 6.18 3.403 5.96 3.403 5.96h2.031v-2.867s-.11-3.404 3.347-3.404h5.765s3.236.052 3.236-3.128V3.128S18.28 0 11.914 0zM8.708 1.81a1.044 1.044 0 1 1 0 2.086 1.044 1.044 0 0 1 0-2.086z"/>
              <path d="M12.086 24c6.094 0 5.714-2.656 5.714-2.656l-.007-2.752H12v-.826h8.11S24 18.211 24 12.031c0-6.18-3.403-5.96-3.403-5.96h-2.031v2.867s.11 3.404-3.347 3.404H9.454s-3.236-.052-3.236 3.128v5.402S5.72 24 12.086 24zm3.206-1.81a1.044 1.044 0 1 1 0-2.086 1.044 1.044 0 0 1 0 2.086z"/>
            </svg>
            <span className="font-semibold text-base tracking-tight">PyPI</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `hsl(var(--eco-python)/0.12)`, color: ACCENT }}>
              registry proxy
            </span>
            {cachedQ.data?.packages?.length ? (
              <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">
                {cachedQ.data.packages.length} cached
              </span>
            ) : null}
          </div>

          {/* Search input */}
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
              onChange={(e) => { setQ(e.target.value); setFocusedIdx(-1); }}
              onKeyDown={handleKeyDown}
              placeholder="Search packages…"
              className="h-12 w-full rounded-xl border border-border bg-background/80 pl-10 pr-24 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-shadow"
              style={{ "--tw-ring-color": "hsl(var(--eco-python)/0.35)" } as React.CSSProperties}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {q && (
                <button onClick={() => setQ("")}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1">
                  ✕
                </button>
              )}
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                <span>⌘</span><span>K</span>
              </kbd>
            </div>
          </div>

          {/* Recent history */}
          <AnimatePresence>
            {!dq && history.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                <div className="mt-3 flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground">Recent</span>
                  <button onClick={clearHistory} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Clear</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
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

          {/* Quick access chips */}
          {!dq && (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-0.5">
              <span className="text-xs text-muted-foreground flex-shrink-0">Popular:</span>
              {QUICK.map((pkg) => (
                <button key={pkg} onClick={() => applyQuery(pkg)}
                  className="flex-shrink-0 rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                  style={{ ":hover": { borderColor: ACCENT } } as React.CSSProperties}>
                  {pkg}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Pinned packages ───────────────────────────────────────────── */}
      <AnimatePresence>
        {!dq && pinned.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="mb-5">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
                fill="currentColor" stroke="currentColor" strokeWidth="1" className="text-primary">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              Pinned
            </div>
            <div className="flex flex-wrap gap-2">
              {pinned.map((name) => (
                <span key={name} className="group flex items-center gap-1 rounded-lg border border-border bg-card/60 pl-3 pr-1.5 py-1.5">
                  <a href={`/package/${encodeURIComponent(name)}`}
                    className="text-sm font-mono font-medium hover:text-primary transition-colors">{name}</a>
                  <button onClick={() => removePin(name)}
                    className="w-5 h-5 flex items-center justify-center text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all">×</button>
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Results ───────────────────────────────────────────────────── */}
      {searchQ.isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-[108px] rounded-2xl border border-border bg-card/40 animate-pulse" />
          ))}
        </div>
      )}

      {!searchQ.isLoading && dq && items.length === 0 && !searchQ.isError && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium">No packages found for &ldquo;{dq}&rdquo;</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different prefix or check spelling.</p>
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

      <AnimatePresence mode="wait">
        {items.length > 0 && (
          <motion.div key={dq} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="text-xs text-muted-foreground mb-3 px-1">
              {items.length} result{items.length !== 1 ? "s" : ""} for &ldquo;{dq}&rdquo;
            </div>
            <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              variants={staggerContainer(0.03)}
              initial="hidden"
              animate="visible"
            >
              {items.map((r, i) => (
                <motion.div key={r.name} variants={staggerItem} className="h-full">
                  <PyPICard
                    name={r.name}
                    to={`/package/${encodeURIComponent(r.name)}`}
                    cached={cachedSet.has(r.name)}
                    focused={focusedIdx === i}
                  />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={sentinelRef} className="h-1" />

      {searchQ.isFetchingNextPage && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[108px] rounded-2xl border border-border bg-card/40 animate-pulse" />
          ))}
        </div>
      )}

      {!searchQ.hasNextPage && dq && items.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="mt-4 text-center text-xs text-muted-foreground">
          All {items.length} results shown
        </motion.div>
      )}
    </div>
  );
}
