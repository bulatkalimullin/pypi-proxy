import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import { apiGet, PyPIPackageJson } from "../lib/api";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { PipInstallBox } from "../components/PipInstallBox";
import { TabBar } from "../components/TabBar";
import { usePinnedPackages } from "../hooks/usePinnedPackages";
import { staggerContainer, staggerItem } from "../lib/motion";

const MarkdownView = React.lazy(() =>
  import("../components/MarkdownView").then((m) => ({ default: m.MarkdownView }))
);

const ACCENT = "hsl(var(--eco-python))";

type Tab = "overview" | "files" | "dependencies" | "classifiers" | "versions";

const tabVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
};

function MetaRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground break-words">{value}</span>
    </div>
  );
}

export default function PackagePage() {
  const params = useParams();
  const name = params.name ? decodeURIComponent(params.name) : "";
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const { isPinned, toggle: togglePin } = usePinnedPackages();

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
    return f ? all.filter((v) => v.includes(f)) : all;
  }, [releases, filter]);

  const latestFiles = useMemo(() => {
    const v = info.version;
    if (!v || !releases[v]) return [];
    return releases[v];
  }, [releases, info.version]);

  const deps = useMemo(() => {
    const rd = info.requires_dist ?? [];
    const required: string[] = [];
    const extras: string[] = [];
    for (const d of rd) {
      if (d.includes("; extra ==")) extras.push(d);
      else required.push(d);
    }
    return { required, extras };
  }, [info.requires_dist]);

  const pinned = isPinned(name);

  const isDeprecated = info.classifiers?.some((c) =>
    c.includes("Development Status :: 7 - Inactive")
  ) ?? false;

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "files", label: `Files${latestFiles.length > 0 ? ` (${latestFiles.length})` : ""}` },
    { key: "dependencies", label: `Deps${deps.required.length > 0 ? ` (${deps.required.length})` : ""}` },
    { key: "classifiers", label: `Tags${info.classifiers?.length ? ` (${info.classifiers.length})` : ""}` },
    { key: "versions", label: `Versions${versions.length > 0 ? ` (${versions.length})` : ""}` },
  ];

  return (
    <div>
      {/* Breadcrumbs */}
      <motion.div
        className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap"
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Link to="/" className="hover:text-foreground transition-colors">PyPI</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{name}</span>
      </motion.div>

      {/* Header banner */}
      <motion.div
        className="mt-3 rounded-2xl border border-border p-5 sm:p-6"
        style={{
          background: `linear-gradient(135deg, hsl(var(--eco-python)/0.07) 0%, transparent 55%)`,
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.04 }}
      >
        {isDeprecated && (
          <div className="mb-3 rounded-lg border border-orange-500/30 bg-orange-500/8 px-3 py-2 text-xs text-orange-600 dark:text-orange-400">
            ⚠ This package is marked as inactive (Development Status :: 7 - Inactive)
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight font-mono">
                {info.name ?? name}
              </h1>
              {info.version && (
                <motion.span
                  className="rounded-full border border-border bg-card/40 px-3 py-0.5 text-xs text-muted-foreground"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 300 }}
                >
                  v{info.version}
                </motion.span>
              )}
              {info.requires_python && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: "hsl(142 70% 45% / 0.12)", color: "hsl(142 60% 38%)" }}
                >
                  py{info.requires_python}
                </span>
              )}
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "hsl(var(--eco-python)/0.12)", color: ACCENT }}
              >
                PyPI
              </span>
            </div>
            {info.summary && (
              <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{info.summary}</p>
            )}
            {info.keywords && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {info.keywords.split(/[\s,]+/).filter(Boolean).slice(0, 8).map((kw) => (
                  <span key={kw} className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
          <motion.button
            onClick={() => togglePin(name)}
            title={pinned ? "Unpin package" : "Pin package"}
            className={`flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
              pinned
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card/40 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <motion.svg
              xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
              fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              animate={{ rotate: pinned ? [0, -15, 15, 0] : 0 }}
              transition={{ duration: 0.4 }}
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </motion.svg>
          </motion.button>
        </div>
      </motion.div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Sidebar — install + meta — order-1 on mobile (shown first) */}
        <motion.div
          className="lg:col-span-2 order-1 lg:order-2 space-y-4 lg:sticky lg:top-[4.5rem] lg:self-start"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: 0.08 }}
        >
          <PipInstallBox packageName={info.name ?? name} />

          {q.isLoading && (
            <div className="rounded-2xl border border-border bg-card/40 p-4">
              <Skeleton className="h-4 w-20 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            </div>
          )}

          {q.isError && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="text-sm font-medium text-destructive">Failed to load package</div>
              <div className="mt-1 text-sm text-muted-foreground">{String(q.error)}</div>
            </div>
          )}

          {!q.isLoading && !q.isError && (
            <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
              <div className="text-sm font-medium">Info</div>
              <MetaRow label="Author" value={info.author} />
              <MetaRow label="License" value={info.license} />
              {(info.project_urls?.Homepage || info.home_page) && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Homepage</span>
                  <a
                    href={info.project_urls?.Homepage ?? info.home_page}
                    target="_blank" rel="noreferrer"
                    className="text-sm text-primary hover:underline break-all"
                  >
                    {info.project_urls?.Homepage ?? info.home_page}
                  </a>
                </div>
              )}
              {Object.entries(info.project_urls ?? {}).filter(([k]) => k !== "Homepage").map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <a href={v} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline break-all">{v}</a>
                </div>
              ))}
              <div className="flex flex-col gap-0.5 pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">PyPI</span>
                <a
                  href={`https://pypi.org/project/${encodeURIComponent(name)}`}
                  target="_blank" rel="noreferrer"
                  className="text-sm text-primary hover:underline break-all"
                >
                  pypi.org/project/{name}
                </a>
              </div>
            </div>
          )}
        </motion.div>

        {/* Main — tabs — order-2 on mobile (shown second) */}
        <motion.div
          className="lg:col-span-3 min-w-0 order-2 lg:order-1"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.12 }}
        >
          <TabBar
            tabs={tabs}
            active={tab}
            onChange={(k) => setTab(k as Tab)}
            accentColor={ACCENT}
            layoutId="pypi-detail-tab"
          />

          <div className="mt-4">
            <AnimatePresence mode="wait">
              {tab === "overview" && (
                <motion.div key="overview" variants={tabVariants} initial="initial" animate="animate" exit="exit"
                  className="rounded-2xl border border-border bg-card/40 p-5">
                  <div className="text-sm font-medium mb-3">Description</div>
                  {q.isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  ) : (
                    <div>
                      {info.description ? (
                        <React.Suspense fallback={
                          <div className="space-y-2">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-5/6" />
                            <Skeleton className="h-3 w-4/6" />
                          </div>
                        }>
                          <MarkdownView content={info.description} />
                        </React.Suspense>
                      ) : (
                        <div className="text-sm text-muted-foreground">No description available.</div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {tab === "files" && (
                <motion.div key="files" variants={tabVariants} initial="initial" animate="animate" exit="exit"
                  className="rounded-2xl border border-border bg-card/40 p-4">
                  <div className="text-sm font-medium mb-3">Files for {info.version ?? "latest"}</div>
                  {latestFiles.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No files available.</div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-sm min-w-[400px]">
                        <thead className="bg-muted/40 text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2.5 text-left font-medium text-xs">Filename</th>
                            <th className="px-4 py-2.5 text-left font-medium text-xs hidden sm:table-cell">Type</th>
                            <th className="px-4 py-2.5 text-right font-medium text-xs">Size</th>
                          </tr>
                        </thead>
                        <motion.tbody className="divide-y divide-border"
                          variants={staggerContainer(0.04)} initial="hidden" animate="visible">
                          {latestFiles.map((f, i) => (
                            <motion.tr key={i} variants={staggerItem} className="hover:bg-muted/30">
                              <td className="px-4 py-2.5 font-mono text-xs truncate max-w-[180px] sm:max-w-none">{f.filename ?? "-"}</td>
                              <td className="px-4 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">{f.packagetype ?? "-"}</td>
                              <td className="px-4 py-2.5 text-right text-muted-foreground text-xs whitespace-nowrap">
                                {typeof f.size === "number" ? `${Math.round(f.size / 1024)} KB` : "-"}
                              </td>
                            </motion.tr>
                          ))}
                        </motion.tbody>
                      </table>
                    </div>
                  )}
                  {info.version && (
                    <div className="mt-3">
                      <Link to={`/package/${encodeURIComponent(name)}/${encodeURIComponent(info.version)}`}
                        className="text-xs text-primary hover:underline">
                        View version details with download links →
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}

              {tab === "dependencies" && (
                <motion.div key="dependencies" variants={tabVariants} initial="initial" animate="animate" exit="exit"
                  className="rounded-2xl border border-border bg-card/40 p-4">
                  {deps.required.length === 0 && deps.extras.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No dependencies listed.</div>
                  ) : (
                    <>
                      {deps.required.length > 0 && (
                        <div>
                          <div className="text-sm font-medium mb-3">Required ({deps.required.length})</div>
                          <motion.div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2"
                            variants={staggerContainer(0.04)} initial="hidden" animate="visible">
                            {deps.required.map((d, i) => {
                              const pkgName = d.split(/[\s;>=<![(]/)[0].trim();
                              return (
                                <motion.div key={i} variants={staggerItem}
                                  className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 min-w-0"
                                  whileHover={{ borderColor: "hsl(var(--eco-python) / 0.4)" }}>
                                  <Link to={`/package/${encodeURIComponent(pkgName)}`}
                                    className="text-xs font-medium text-primary hover:underline font-mono shrink-0">
                                    {pkgName}
                                  </Link>
                                  <span className="text-xs text-muted-foreground truncate">{d.slice(pkgName.length).trim()}</span>
                                </motion.div>
                              );
                            })}
                          </motion.div>
                        </div>
                      )}
                      {deps.extras.length > 0 && (
                        <div className={deps.required.length > 0 ? "mt-5" : ""}>
                          <div className="text-sm font-medium mb-3">Extras ({deps.extras.length})</div>
                          <motion.div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2"
                            variants={staggerContainer(0.04)} initial="hidden" animate="visible">
                            {deps.extras.map((d, i) => {
                              const pkgName = d.split(/[\s;>=<![(]/)[0].trim();
                              return (
                                <motion.div key={i} variants={staggerItem}
                                  className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 min-w-0">
                                  <Link to={`/package/${encodeURIComponent(pkgName)}`}
                                    className="text-xs font-medium text-muted-foreground hover:text-primary font-mono shrink-0">
                                    {pkgName}
                                  </Link>
                                  <span className="text-xs text-muted-foreground/70 truncate">{d.slice(pkgName.length).trim()}</span>
                                </motion.div>
                              );
                            })}
                          </motion.div>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {tab === "classifiers" && (
                <motion.div key="classifiers" variants={tabVariants} initial="initial" animate="animate" exit="exit"
                  className="rounded-2xl border border-border bg-card/40 p-4">
                  {!info.classifiers?.length ? (
                    <div className="text-sm text-muted-foreground">No classifiers available.</div>
                  ) : (
                    <motion.div className="flex flex-wrap gap-2"
                      variants={staggerContainer(0.03)} initial="hidden" animate="visible">
                      {info.classifiers.map((c, i) => (
                        <motion.span key={i} variants={staggerItem}
                          className="rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
                          whileHover={{ scale: 1.04 }}>
                          {c}
                        </motion.span>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )}

              {tab === "versions" && (
                <motion.div key="versions" variants={tabVariants} initial="initial" animate="animate" exit="exit"
                  className="rounded-2xl border border-border bg-card/40 p-4">
                  {q.isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="text-sm font-medium">All versions</div>
                        <div className="text-xs text-muted-foreground">{versions.length} total</div>
                      </div>
                      <Input value={filter} onChange={(e) => setFilter(e.target.value)}
                        placeholder="Filter versions…" className="mb-3" />
                      <div className="max-h-[20rem] overflow-auto rounded-xl border border-border">
                        <motion.div className="divide-y divide-border"
                          variants={staggerContainer(0.02)} initial="hidden" animate="visible">
                          {versions.map((v, i) => (
                            <motion.div key={v} variants={i < 20 ? staggerItem : undefined}>
                              <Link
                                to={`/package/${encodeURIComponent(name)}/${encodeURIComponent(v)}`}
                                className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors"
                              >
                                <span className="font-mono text-xs">{v}</span>
                                {v === info.version ? (
                                  <span className="text-xs px-1.5 py-0.5 rounded"
                                    style={{ backgroundColor: "hsl(var(--eco-python)/0.12)", color: ACCENT }}>
                                    latest
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">→</span>
                                )}
                              </Link>
                            </motion.div>
                          ))}
                        </motion.div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
