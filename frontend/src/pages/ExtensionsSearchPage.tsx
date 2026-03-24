import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";

import { apiGet, type ExtensionSearchResponse } from "../lib/api";
import { ExtensionListItem } from "../components/ExtensionListItem";

const QUICK = ["python", "eslint", "prettier", "docker", "gitlens", "theme"];

export default function ExtensionsSearchPage() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [verified, setVerified] = useState(false);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("relevance");

  const filters = useMemo(
    () => ({ minRating: Number(minRating), verified, category, sort }),
    [minRating, verified, category, sort]
  );

  const searchQ = useInfiniteQuery({
    queryKey: ["extensions", "search", query, filters],
    enabled: query.trim().length > 0,
    initialPageParam: 1,
    queryFn: ({ pageParam = 1 }) =>
      apiGet<ExtensionSearchResponse>(
        `/api/extensions/search?q=${encodeURIComponent(query)}&page=${pageParam}&limit=20&min_rating=${filters.minRating}&verified=${filters.verified}&category=${encodeURIComponent(filters.category)}&sort=${encodeURIComponent(filters.sort)}`
      ),
    getNextPageParam: (last) => last.nextPage ?? undefined,
  });

  const results = searchQ.data?.pages.flatMap((p) => p.results) ?? [];
  const hasMore = searchQ.data?.pages[searchQ.data.pages.length - 1]?.hasMore ?? false;

  return (
    <div>
      <div className="rounded-2xl border border-border bg-card/50 p-5">
        <h1 className="text-lg font-semibold">VS Code Extensions</h1>
        <p className="text-xs text-muted-foreground mt-1">Proxy catalog with ratings, logos and VSIX download.</p>
        <div className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setQuery(q.trim());
            }}
            placeholder="Search extensions..."
            className="h-11 w-full rounded-xl border border-border bg-background/80 px-3 text-sm"
          />
          <button className="rounded-xl border border-border px-4 text-sm" onClick={() => setQuery(q.trim())}>Search</button>
        </div>
        <div className="mt-3 grid sm:grid-cols-4 gap-2">
          <select value={minRating} onChange={(e) => setMinRating(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-xs">
            <option value="0">Any rating</option>
            <option value="3">3.0+</option>
            <option value="4">4.0+</option>
            <option value="4.5">4.5+</option>
          </select>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (e.g. themes)" className="h-9 rounded-lg border border-border bg-background px-2 text-xs" />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2 text-xs">
            <option value="relevance">Sort: relevance</option>
            <option value="installs">Sort: installs</option>
          </select>
          <label className="h-9 rounded-lg border border-border bg-background px-2 text-xs flex items-center gap-2">
            <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            Verified only
          </label>
        </div>
        {!query && (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs text-muted-foreground">Popular:</span>
            {QUICK.map((it) => (
              <button key={it} className="rounded-full border border-border px-2 py-0.5 text-xs" onClick={() => { setQ(it); setQuery(it); }}>
                {it}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {results.map((item) => (
          <ExtensionListItem
            key={item.id}
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
        ))}
      </div>

      {searchQ.isLoading && <div className="mt-4 text-sm text-muted-foreground">Loading...</div>}
      {!searchQ.isLoading && query && results.length === 0 && (
        <div className="mt-6 text-sm text-muted-foreground">
          No extensions found for "{query}".
        </div>
      )}

      {hasMore && (
        <div className="mt-4 text-center">
          <button className="rounded-xl border border-border px-4 py-2 text-sm" onClick={() => void searchQ.fetchNextPage()} disabled={searchQ.isFetchingNextPage}>
            {searchQ.isFetchingNextPage ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      <div className="mt-6 text-xs text-muted-foreground">
        Need direct VSIX? Open any extension page and use install tabs.
        {" "}
        <Link to="/extensions/microsoft/python" className="underline">Example</Link>
      </div>
    </div>
  );
}
