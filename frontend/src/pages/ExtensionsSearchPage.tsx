import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

import { apiGet, type ExtensionSearchResponse } from "../lib/api";
import { ExtensionListItem } from "../components/ExtensionListItem";
import { staggerContainer, staggerItem } from "../lib/motion";

const ACCENT = "hsl(var(--eco-vscode))";
const QUICK = ["python", "eslint", "prettier", "docker", "gitlens", "theme"];

function useDebounce(value: string, ms: number) {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDeb(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return deb;
}

export default function ExtensionsSearchPage() {
  const [q, setQ] = useState("");
  const dq = useDebounce(q.trim(), 300);
  const [minRating, setMinRating] = useState("0");
  const [verified, setVerified] = useState(false);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("relevance");
  const inputRef = useRef<HTMLInputElement>(null);

  const filters = useMemo(
    () => ({ minRating: Number(minRating), verified, category, sort }),
    [minRating, verified, category, sort]
  );

  const searchQ = useInfiniteQuery({
    queryKey: ["extensions", "search", dq, filters],
    enabled: dq.length > 0,
    initialPageParam: 1,
    staleTime: 60_000,
    queryFn: ({ pageParam = 1 }) =>
      apiGet<ExtensionSearchResponse>(
        `/api/extensions/search?q=${encodeURIComponent(dq)}&page=${pageParam}&limit=20&min_rating=${filters.minRating}&verified=${filters.verified}&category=${encodeURIComponent(filters.category)}&sort=${encodeURIComponent(filters.sort)}`
      ),
    getNextPageParam: (last) => last.nextPage ?? undefined,
  });

  const results = searchQ.data?.pages.flatMap((p) => p.results) ?? [];
  const hasMore = searchQ.data?.pages[searchQ.data.pages.length - 1]?.hasMore ?? false;

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMore = useCallback(() => {
    if (!searchQ.hasNextPage || searchQ.isFetchingNextPage) return;
    void searchQ.fetchNextPage();
  }, [searchQ]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) loadMore(); },
      { rootMargin: "400px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  // Keyboard shortcut
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

  return (
    <div>
      {/* ── Hero: ecosystem identity ──────────────────────────────────── */}
      <motion.div
        className="rounded-2xl border border-border bg-card/40 p-5 sm:p-6 mb-5 overflow-hidden relative"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <div className="relative z-10">
          {/* Identity strip */}
          <div className="flex items-center gap-2 mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ color: ACCENT }}>
              <path d="M16.98 2 6.34 12.1l3.42 3.2L19.4 6v12l-9.64-9.3-3.42 3.2L16.98 22 22 20V4l-5.02-2zM2 12l2.86-2.55 2.11 2.04-2.1 2.04L2 12z" />
            </svg>
            <span className="font-semibold text-base tracking-tight">VS Code Extensions</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `hsl(var(--eco-vscode)/0.12)`, color: ACCENT }}>
              proxy catalog
            </span>
          </div>

          <p className="text-xs text-muted-foreground mb-3">
            Search, browse and download VSIX — with ratings, logos and caching.
            One-liner install: <code className="font-mono text-[11px] bg-muted/60 px-1 rounded">curl -sL /extensions/install.sh | bash -s -- publisher.name</code>
          </p>

          {/* Search input */}
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search extensions…"
              className="h-12 w-full rounded-xl border border-border bg-background/80 pl-10 pr-24 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-shadow"
              style={{ "--tw-ring-color": "hsl(var(--eco-vscode)/0.35)" } as React.CSSProperties}
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

          {/* Filters */}
          <div className="mt-3 grid sm:grid-cols-4 gap-2">
            <select value={minRating} onChange={(e) => setMinRating(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 transition-shadow"
              style={{ "--tw-ring-color": "hsl(var(--eco-vscode)/0.35)" } as React.CSSProperties}>
              <option value="0">Any rating</option>
              <option value="3">3.0+</option>
              <option value="4">4.0+</option>
              <option value="4.5">4.5+</option>
            </select>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (e.g. themes)"
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 transition-shadow"
              style={{ "--tw-ring-color": "hsl(var(--eco-vscode)/0.35)" } as React.CSSProperties} />
            <select value={sort} onChange={(e) => setSort(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 transition-shadow"
              style={{ "--tw-ring-color": "hsl(var(--eco-vscode)/0.35)" } as React.CSSProperties}>
              <option value="relevance">Sort: relevance</option>
              <option value="installs">Sort: installs</option>
            </select>
            <label className="h-9 rounded-lg border border-border bg-background px-2 text-xs flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="accent-current" style={{ color: ACCENT }} />
              Verified only
            </label>
          </div>

          {/* Quick access chips */}
          {!dq && (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-0.5">
              <span className="text-xs text-muted-foreground flex-shrink-0">Popular:</span>
              {QUICK.map((it) => (
                <button key={it} onClick={() => setQ(it)}
                  className="flex-shrink-0 rounded-full border border-border bg-background/60 px-2.5 py-0.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
                  {it}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Results ───────────────────────────────────────────────────── */}
      {searchQ.isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[96px] rounded-2xl border border-border bg-card/40 animate-pulse" />
          ))}
        </div>
      )}

      {!searchQ.isLoading && dq && results.length === 0 && !searchQ.isError && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium">No extensions found for &ldquo;{dq}&rdquo;</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different query.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {QUICK.map((s) => (
              <button key={s} onClick={() => setQ(s)}
                className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
                {s}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {results.length > 0 && (
          <motion.div key={dq} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="text-xs text-muted-foreground mb-3 px-1">
              {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{dq}&rdquo;
            </div>
            <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-3"
              variants={staggerContainer(0.03)}
              initial="hidden"
              animate="visible"
            >
              {results.map((item) => (
                <motion.div key={item.id} variants={staggerItem} className="h-full">
                  <ExtensionListItem
                    id={item.id}
                    name={item.displayName || item.name}
                    publisher={item.publisher}
                    description={item.description}
                    logoUrl={item.logoUrl}
                    rating={item.rating}
                    installs={item.installs}
                    verified={item.verified}
                    to={`/extensions/${item.publisher}/${item.name}`}
                  />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={sentinelRef} className="h-1" />

      {searchQ.isFetchingNextPage && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[96px] rounded-2xl border border-border bg-card/40 animate-pulse" />
          ))}
        </div>
      )}

      {!searchQ.hasNextPage && dq && results.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="mt-4 text-center text-xs text-muted-foreground">
          All {results.length} results shown
        </motion.div>
      )}

      <div className="mt-6 text-xs text-muted-foreground">
        Need direct VSIX? Open any extension page and use install tabs.
        {" "}
        <Link to="/extensions/microsoft/python" className="underline">Example</Link>
      </div>
    </div>
  );
}
