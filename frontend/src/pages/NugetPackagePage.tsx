import React, { Suspense, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiGet } from "../lib/api";
import { Skeleton } from "../components/ui/skeleton";
import { NugetInstallBox } from "../components/NugetInstallBox";
import { TabBar } from "../components/TabBar";

const ACCENT = "hsl(var(--eco-nuget))";

type DepGroup = {
  targetFramework?: string;
  dependencies?: Array<{ id: string; range: string }>;
};

type NugetPackageInfo = {
  id: string; version: string; description: string; authors: string;
  projectUrl: string; licenseUrl: string; licenseExpression: string;
  tags: string[] | string; dependencyGroups: DepGroup[]; versions: string[];
};

type Tab = "overview" | "dependencies" | "versions";

const tabVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
};

function normalizeTags(tags: string[] | string | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return tags.split(/[\s,]+/).filter(Boolean);
}

// Target framework → friendly chip style
function frameworkChip(fw: string) {
  const lower = fw.toLowerCase();
  let bg = "hsl(var(--eco-nuget)/0.10)";
  let color = ACCENT;
  if (lower.includes("netstandard")) { bg = "hsl(210 80% 55%/0.12)"; color = "hsl(210 80% 45%)"; }
  else if (lower.includes("net6") || lower.includes("net7") || lower.includes("net8") || lower.includes("net9")) {
    bg = "hsl(142 70% 45%/0.12)"; color = "hsl(142 60% 38%)";
  } else if (lower.includes("netcore")) { bg = "hsl(262 80% 60%/0.12)"; color = "hsl(262 80% 52%)"; }
  else if (lower.includes("netframework") || lower.includes("net4")) { bg = "hsl(var(--eco-nuget)/0.10)"; color = ACCENT; }
  return { bg, color };
}

export default function NugetPackagePage() {
  const { id } = useParams<{ id: string }>();
  const decoded = id ? decodeURIComponent(id) : "";
  const [tab, setTab] = useState<Tab>("overview");

  const q = useQuery({
    queryKey: ["nuget", "package", decoded],
    enabled: !!decoded,
    queryFn: () => apiGet<NugetPackageInfo>(`/api/nuget/package/${encodeURIComponent(decoded)}`),
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
        <Link to="/nuget" className="underline">Back to search</Link>
      </div>
    );
  }

  const tags = normalizeTags(info.tags);
  const depGroups = info.dependencyGroups ?? [];
  const license = info.licenseExpression || info.licenseUrl;
  const totalDeps = depGroups.reduce((sum, g) => sum + (g.dependencies?.length ?? 0), 0);

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "dependencies", label: `Deps${totalDeps > 0 ? ` (${totalDeps})` : ""}` },
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
        <Link to="/nuget" className="hover:text-foreground transition-colors">NuGet</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{info.id}</span>
      </motion.div>

      {/* Header banner */}
      <motion.div
        className="mt-3 rounded-2xl border border-border p-5 sm:p-6"
        style={{
          background: `linear-gradient(135deg, hsl(var(--eco-nuget)/0.07) 0%, transparent 55%)`,
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.05 }}
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono">{info.id}</h1>
          {info.version && (
            <span className="text-sm text-muted-foreground font-mono">v{info.version}</span>
          )}
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "hsl(var(--eco-nuget)/0.12)", color: ACCENT }}
          >NuGet</span>
        </div>
        {info.description && (
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{info.description}</p>
        )}
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.slice(0, 8).map((tag) => (
              <span key={tag} className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                {tag}
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
          <NugetInstallBox packageName={info.id} />

          <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
            {info.authors && (
              <div>
                <div className="text-xs text-muted-foreground">Authors</div>
                <div className="mt-0.5 text-sm">{info.authors}</div>
              </div>
            )}
            {license && (
              <div>
                <div className="text-xs text-muted-foreground">License</div>
                {info.licenseUrl ? (
                  <a href={info.licenseUrl} target="_blank" rel="noreferrer"
                    className="mt-0.5 text-sm hover:underline text-primary">
                    {info.licenseExpression || "View license"}
                  </a>
                ) : (
                  <div className="mt-0.5 text-sm">{info.licenseExpression}</div>
                )}
              </div>
            )}
            {info.projectUrl && (
              <div>
                <div className="text-xs text-muted-foreground">Project URL</div>
                <a href={info.projectUrl} target="_blank" rel="noreferrer"
                  className="mt-0.5 text-sm hover:underline break-all text-primary">
                  {info.projectUrl}
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
              <span className="text-xs text-muted-foreground">C# / .NET</span>
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
            layoutId="nuget-detail-tab"
          />

          <AnimatePresence mode="wait">
            <motion.div key={tab} variants={tabVariants} initial="initial" animate="animate" exit="exit" className="mt-4">
              {tab === "overview" && (
                <div className="rounded-2xl border border-border bg-card/40 p-5">
                  {info.description ? (
                    <p className="text-sm leading-relaxed">{info.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No description available.</p>
                  )}
                </div>
              )}

              {tab === "dependencies" && (
                <div className="space-y-5">
                  {depGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No dependencies.</p>
                  ) : (
                    depGroups.map((group, gi) => {
                      const groupDeps = group.dependencies ?? [];
                      const chip = group.targetFramework ? frameworkChip(group.targetFramework) : null;
                      return (
                        <div key={gi}>
                          {group.targetFramework && (
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className="text-xs font-medium px-2.5 py-0.5 rounded-full"
                                style={{ backgroundColor: chip!.bg, color: chip!.color }}
                              >
                                {group.targetFramework}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {groupDeps.length} dep{groupDeps.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                          {groupDeps.length > 0 && (
                            <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
                              {groupDeps.map((dep, i) => (
                                <div key={dep.id}
                                  className={`flex items-center justify-between px-4 py-2.5 text-xs hover:bg-muted/30 transition-colors ${i < groupDeps.length - 1 ? "border-b border-border" : ""}`}>
                                  <Link to={`/nuget/package/${encodeURIComponent(dep.id)}`}
                                    className="font-mono hover:underline text-primary">{dep.id}</Link>
                                  <span className="text-muted-foreground font-mono">{dep.range}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {groupDeps.length === 0 && (
                            <p className="text-xs text-muted-foreground">No dependencies for this target.</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {tab === "versions" && (
                <div className="rounded-2xl border border-border bg-card/40 overflow-hidden max-h-[24rem] overflow-y-auto">
                  {(info.versions ?? []).map((ver, i) => (
                    <div key={ver}
                      className={`flex items-center justify-between px-4 py-2.5 text-xs hover:bg-muted/30 transition-colors ${i < (info.versions?.length ?? 0) - 1 ? "border-b border-border" : ""}`}>
                      <span className="font-mono">{ver}</span>
                      {ver === info.version && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: "hsl(var(--eco-nuget)/0.12)", color: ACCENT }}>
                          latest
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
