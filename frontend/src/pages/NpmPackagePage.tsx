import React, { Suspense, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiGet } from "../lib/api";
import { Skeleton } from "../components/ui/skeleton";
import { NpmInstallBox } from "../components/NpmInstallBox";
import { TabBar } from "../components/TabBar";

const MarkdownView = React.lazy(() =>
  import("../components/MarkdownView").then((m) => ({ default: m.MarkdownView }))
);

const ACCENT = "hsl(var(--eco-npm))";

type NpmPackageInfo = {
  name: string; version: string; description: string; license: string;
  homepage: string; repository: { url?: string } | string;
  keywords: string[]; dependencies: Record<string, string>;
  devDependencies: Record<string, string>; peerDependencies: Record<string, string>;
  versions: string[]; readme: string; dist_tags: Record<string, string>;
};

type Tab = "overview" | "dependencies" | "versions";

const tabVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
};

const DIST_TAG_COLORS: Record<string, { bg: string; text: string }> = {
  latest: { bg: "hsl(var(--eco-npm)/0.12)", text: "hsl(var(--eco-npm))" },
  beta:   { bg: "hsl(38 95% 50% / 0.12)", text: "hsl(38 95% 45%)" },
  next:   { bg: "hsl(262 80% 60% / 0.12)", text: "hsl(262 80% 55%)" },
  canary: { bg: "hsl(200 80% 50% / 0.12)", text: "hsl(200 80% 42%)" },
};

function repoUrl(repo: NpmPackageInfo["repository"]): string {
  if (!repo) return "";
  if (typeof repo === "string") return repo;
  const url = repo.url ?? "";
  return url.replace(/^git\+/, "").replace(/\.git$/, "").replace("git://", "https://");
}

export default function NpmPackagePage() {
  const params = useParams<{ "*": string }>();
  const decoded = params["*"] ? decodeURIComponent(params["*"]) : "";
  const [tab, setTab] = useState<Tab>("overview");

  const q = useQuery({
    queryKey: ["npm", "package", decoded],
    enabled: !!decoded,
    queryFn: () => apiGet<NpmPackageInfo>(`/api/npm/package/${decoded}`),
    staleTime: 60_000,
  });

  const info = q.data;

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-32 rounded bg-muted/50 animate-pulse" />
        <div className="h-28 rounded-2xl border border-border bg-card/40 animate-pulse" />
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-3 order-1 lg:order-2">
            <Skeleton className="h-40 w-full" />
          </div>
          <div className="lg:col-span-3 space-y-3 order-2 lg:order-1">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (q.isError || !info) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
        Package not found or error loading.{" "}
        <Link to="/npm" className="underline">Back to search</Link>
      </div>
    );
  }

  const deps = Object.entries(info.dependencies ?? {});
  const devDeps = Object.entries(info.devDependencies ?? {});
  const peerDeps = Object.entries(info.peerDependencies ?? {});
  const distTags = Object.entries(info.dist_tags ?? {});

  // Detect scoped package
  const isScoped = decoded.startsWith("@");
  const scopePart = isScoped ? decoded.split("/")[0] : null;

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "dependencies", label: `Deps${deps.length + devDeps.length + peerDeps.length > 0 ? ` (${deps.length})` : ""}` },
    { key: "versions", label: `Versions${info.versions?.length ? ` (${info.versions.length})` : ""}` },
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
        <Link to="/npm" className="hover:text-foreground transition-colors">npm</Link>
        <span>/</span>
        <span className="text-foreground font-medium font-mono">{info.name}</span>
      </motion.div>

      {/* Header banner */}
      <motion.div
        className="mt-3 rounded-2xl border border-border p-5 sm:p-6"
        style={{
          background: `linear-gradient(135deg, hsl(var(--eco-npm)/0.07) 0%, transparent 55%)`,
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.05 }}
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          {scopePart && (
            <span className="text-base font-mono font-medium text-muted-foreground">{scopePart}/</span>
          )}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono">
            {isScoped ? decoded.split("/").slice(1).join("/") : info.name}
          </h1>
          {info.version && (
            <span className="text-sm text-muted-foreground font-mono">v{info.version}</span>
          )}
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "hsl(var(--eco-npm)/0.12)", color: ACCENT }}
          >npm</span>
        </div>

        {/* dist-tags chips */}
        {distTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {distTags.slice(0, 6).map(([tag, ver]) => {
              const colors = DIST_TAG_COLORS[tag] ?? { bg: "hsl(var(--muted)/0.4)", text: "hsl(var(--muted-foreground))" };
              return (
                <span key={tag} className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: colors.bg, color: colors.text }}>
                  {tag}: {ver}
                </span>
              );
            })}
          </div>
        )}

        {info.description && (
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{info.description}</p>
        )}
        {info.keywords?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {info.keywords.slice(0, 8).map((kw) => (
              <span key={kw} className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                {kw}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Main layout */}
      <div className="mt-6 grid lg:grid-cols-5 gap-6">
        {/* Sidebar — order-1 on mobile */}
        <motion.div
          className="lg:col-span-2 order-1 lg:order-2 space-y-4 lg:sticky lg:top-[4.5rem] lg:self-start"
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: 0.08 }}
        >
          <NpmInstallBox packageName={info.name} />

          <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
            {info.license && (
              <div>
                <div className="text-xs text-muted-foreground">License</div>
                <div className="mt-0.5 text-sm">{info.license}</div>
              </div>
            )}
            {info.homepage && (
              <div>
                <div className="text-xs text-muted-foreground">Homepage</div>
                <a href={info.homepage} target="_blank" rel="noreferrer"
                  className="mt-0.5 text-sm hover:underline break-all text-primary">
                  {info.homepage}
                </a>
              </div>
            )}
            {info.repository && repoUrl(info.repository) && (
              <div>
                <div className="text-xs text-muted-foreground">Repository</div>
                <a href={repoUrl(info.repository)} target="_blank" rel="noreferrer"
                  className="mt-0.5 text-sm hover:underline break-all text-primary">
                  {repoUrl(info.repository)}
                </a>
              </div>
            )}
            {info.versions?.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground">Versions</div>
                <div className="mt-0.5 text-sm">{info.versions.length} releases</div>
              </div>
            )}
            <div className="pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground mb-0.5">Ecosystem</div>
              <span className="text-xs text-muted-foreground">JavaScript / Node.js</span>
            </div>
          </div>
        </motion.div>

        {/* Main — tabs — order-2 on mobile */}
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
            layoutId="npm-detail-tab"
          />

          <AnimatePresence mode="wait">
            <motion.div key={tab} variants={tabVariants} initial="initial" animate="animate" exit="exit" className="mt-4">
              {tab === "overview" && (
                <div className="rounded-2xl border border-border bg-card/40 p-5">
                  {info.readme ? (
                    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
                      <div className="md-content prose-sm max-w-none">
                        <MarkdownView content={info.readme} />
                      </div>
                    </Suspense>
                  ) : (
                    <p className="text-sm text-muted-foreground">{info.description || "No description available."}</p>
                  )}
                </div>
              )}

              {tab === "dependencies" && (
                <div className="space-y-5">
                  {deps.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Dependencies ({deps.length})
                      </div>
                      <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
                        {deps.map(([dep, ver], i) => (
                          <div key={dep} className={`flex items-center justify-between px-4 py-2.5 text-xs hover:bg-muted/30 transition-colors ${i < deps.length - 1 ? "border-b border-border" : ""}`}>
                            <Link to={`/npm/package/${encodeURIComponent(dep)}`} className="font-mono hover:underline text-primary">{dep}</Link>
                            <span className="text-muted-foreground font-mono">{ver}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {devDeps.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Dev Dependencies ({devDeps.length})
                      </div>
                      <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
                        {devDeps.map(([dep, ver], i) => (
                          <div key={dep} className={`flex items-center justify-between px-4 py-2.5 text-xs hover:bg-muted/30 transition-colors ${i < devDeps.length - 1 ? "border-b border-border" : ""}`}>
                            <Link to={`/npm/package/${encodeURIComponent(dep)}`} className="font-mono hover:underline">{dep}</Link>
                            <span className="text-muted-foreground font-mono">{ver}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {peerDeps.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Peer Dependencies ({peerDeps.length})
                      </div>
                      <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
                        {peerDeps.map(([dep, ver], i) => (
                          <div key={dep} className={`flex items-center justify-between px-4 py-2.5 text-xs hover:bg-muted/30 transition-colors ${i < peerDeps.length - 1 ? "border-b border-border" : ""}`}>
                            <span className="font-mono">{dep}</span>
                            <span className="text-muted-foreground font-mono">{ver}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {deps.length === 0 && devDeps.length === 0 && peerDeps.length === 0 && (
                    <p className="text-sm text-muted-foreground">No dependencies.</p>
                  )}
                </div>
              )}

              {tab === "versions" && (
                <div className="rounded-2xl border border-border bg-card/40 overflow-hidden max-h-[24rem] overflow-y-auto">
                  {(info.versions ?? []).map((ver, i) => {
                    const tagForVer = Object.entries(info.dist_tags ?? {}).find(([, v]) => v === ver);
                    return (
                      <div key={ver} className={`flex items-center justify-between px-4 py-2.5 text-xs hover:bg-muted/30 transition-colors ${i < (info.versions?.length ?? 0) - 1 ? "border-b border-border" : ""}`}>
                        <span className="font-mono">{ver}</span>
                        {tagForVer && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: (DIST_TAG_COLORS[tagForVer[0]] ?? DIST_TAG_COLORS.latest).bg,
                              color: (DIST_TAG_COLORS[tagForVer[0]] ?? DIST_TAG_COLORS.latest).text,
                            }}>
                            {tagForVer[0]}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
