import React, { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { apiGet, ApiSearchResponse } from "../lib/api";

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function useIntersection(onIntersect: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onIntersect();
      },
      { rootMargin: "600px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [onIntersect]);
  return ref;
}

function Header() {
  return (
    <div className="border-b border-border bg-background/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <Link to="/" className="font-semibold tracking-tight">
          PyPI Web UI
        </Link>
        <div className="text-xs text-muted-foreground">Search via /simple index</div>
      </div>
    </div>
  );
}

function ResultSkeletonList() {
  return (
    <div className="mt-6 grid gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card/40 p-4">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="mt-3 h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q.trim(), 400);

  const query = useInfiniteQuery({
    queryKey: ["search", dq],
    enabled: dq.length > 0,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      apiGet<ApiSearchResponse>(
        `/api/search?q=${encodeURIComponent(dq)}&page=${encodeURIComponent(String(pageParam))}&limit=50`
      ),
    getNextPageParam: (last) => {
      if (last.nextPage) return last.nextPage;
      if (last.hasMore) return (last.page || 1) + 1;
      return undefined;
    },
    staleTime: 30_000,
  });

  const items = useMemo(() => {
    const all = query.data?.pages.flatMap((p) => p.results) ?? [];
    // Deduplicate by name
    const seen = new Set<string>();
    return all.filter((x) => {
      if (seen.has(x.name)) return false;
      seen.add(x.name);
      return true;
    });
  }, [query.data]);

  const loadMore = () => {
    if (!query.hasNextPage) return;
    if (query.isFetchingNextPage) return;
    void query.fetchNextPage();
  };

  const sentinelRef = useIntersection(loadMore);

  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-2xl border border-border bg-card/40 p-6">
          <div className="text-xl font-semibold tracking-tight">Search packages</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Debounced search + infinite load. Results come from the mirrored Simple Index.
          </div>

          <div className="mt-5 flex gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Type a prefix (e.g. sql, fast, django)"
            />
            <Button
              variant="secondary"
              onClick={() => {
                setQ("");
              }}
              disabled={!q}
            >
              Clear
            </Button>
          </div>

          {dq.length === 0 ? (
            <div className="mt-4 text-sm text-muted-foreground">Start typing to search.</div>
          ) : null}
        </div>

        {query.isLoading ? <ResultSkeletonList /> : null}

        {query.isError ? (
          <div className="mt-6 rounded-xl border border-border bg-card/40 p-4">
            <div className="text-sm font-medium">Failed to load results</div>
            <div className="mt-1 text-sm text-muted-foreground">{String(query.error)}</div>
            <div className="mt-4">
              <Button onClick={() => void query.refetch()}>Retry</Button>
            </div>
          </div>
        ) : null}

        {!query.isLoading && !query.isError && dq.length > 0 && items.length === 0 ? (
          <div className="mt-6 rounded-xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
            No matches for <span className="text-foreground">{dq}</span>.
          </div>
        ) : null}

        {items.length > 0 ? (
          <motion.div
            className="mt-6 grid gap-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {items.map((r) => (
              <Link
                key={r.name}
                to={`/package/${encodeURIComponent(r.name)}`}
                className="block rounded-xl border border-border bg-card/40 p-4 hover:bg-card/60"
              >
                <div className="font-medium">{r.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">Open package →</div>
              </Link>
            ))}
          </motion.div>
        ) : null}

        <div ref={sentinelRef} className="h-1" />

        {query.isFetchingNextPage ? (
          <div className="mt-6 grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card/40 p-4">
                <Skeleton className="h-4 w-52" />
                <Skeleton className="mt-3 h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : null}

        {query.hasNextPage ? (
          <div className="mt-6 flex justify-center">
            <Button variant="secondary" onClick={loadMore} disabled={query.isFetchingNextPage}>
              Load more
            </Button>
          </div>
        ) : dq.length > 0 && items.length > 0 ? (
          <div className="mt-6 text-center text-sm text-muted-foreground">End of results.</div>
        ) : null}
      </div>
    </div>
  );
}

