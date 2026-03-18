import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";

import { apiGet, PyPIPackageJson } from "../lib/api";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { PipInstallBox } from "../components/PipInstallBox";

function VersionsSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 grid gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function PackagePage() {
  const params = useParams();
  const name = params.name ? decodeURIComponent(params.name) : "";
  const [filter, setFilter] = useState("");

  const q = useQuery({
    queryKey: ["package", name],
    enabled: !!name,
    queryFn: () => apiGet<PyPIPackageJson>(`/api/package/${encodeURIComponent(name)}`),
    staleTime: 60_000,
  });

  const info = q.data?.info ?? {};
  const releases = q.data?.releases ?? {};

  const versions = useMemo(() => {
    const all = Object.keys(releases);
    all.sort((a, b) => (a === b ? 0 : a < b ? 1 : -1));
    const f = filter.trim();
    if (!f) return all;
    return all.filter((v) => v.includes(f));
  }, [releases, filter]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Search
            </Link>{" "}
            / <span className="text-foreground">{name}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{info.name ?? name}</h1>
          {info.summary ? <div className="mt-1 text-sm text-muted-foreground">{info.summary}</div> : null}
        </div>
        {info.version ? (
          <div className="rounded-full border border-border bg-card/40 px-3 py-1 text-xs text-muted-foreground">
            latest <span className="text-foreground">{info.version}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PipInstallBox packageName={info.name ?? name} />

          <div className="mt-6 rounded-2xl border border-border bg-card/40 p-5">
            <div className="text-sm font-medium">Description</div>
            {q.isLoading ? (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : (
              <div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">
                {info.description ? info.description.slice(0, 2000) : "No description."}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {q.isLoading ? (
            <VersionsSkeleton />
          ) : q.isError ? (
            <div className="rounded-2xl border border-border bg-card/40 p-4">
              <div className="text-sm font-medium">Failed to load package</div>
              <div className="mt-1 text-sm text-muted-foreground">{String(q.error)}</div>
            </div>
          ) : (
            <motion.div
              className="rounded-2xl border border-border bg-card/40 p-4"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">Versions</div>
                <div className="text-xs text-muted-foreground">{versions.length}</div>
              </div>
              <div className="mt-3">
                <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter versions…" />
              </div>
              <div className="mt-4 max-h-[28rem] overflow-auto rounded-xl border border-border">
                <div className="divide-y divide-border">
                  {versions.map((v) => (
                    <Link
                      key={v}
                      to={`/package/${encodeURIComponent(name)}/${encodeURIComponent(v)}`}
                      className="flex items-center justify-between px-4 py-3 text-sm hover:bg-card/60"
                    >
                      <span className="font-mono">{v}</span>
                      <span className="text-xs text-muted-foreground">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

