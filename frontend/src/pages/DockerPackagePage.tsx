import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiGet } from "../lib/api";
import { Skeleton } from "../components/ui/skeleton";
import { DockerInstallBox } from "../components/DockerInstallBox";
import { TabBar } from "../components/TabBar";

const ACCENT = "hsl(var(--eco-docker))";

type DockerTag = {
  name: string;
  last_updated?: string;
  digest?: string;
};

type DockerImageInfo = {
  name: string;
  namespace: string;
  description: string;
  is_official: boolean;
  is_automated: boolean;
  star_count: number;
  pull_count: number;
  last_updated?: string;
  tags: DockerTag[];
};

type Tab = "overview" | "tags";

const tabVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
};

function formatPullCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function truncateDigest(digest?: string): string {
  if (!digest) return "";
  // sha256:abc123... → sha256:abc123
  const [prefix, hash] = digest.split(":");
  if (!hash) return digest.slice(0, 16) + "…";
  return `${prefix}:${hash.slice(0, 12)}…`;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <motion.button
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] border border-border bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
      whileTap={{ scale: 0.92 }}
    >
      {copied ? "✓" : "copy"}
    </motion.button>
  );
}

// Decorative Docker layer stack — purely visual
function LayerStack() {
  return (
    <div className="relative w-24 h-20 flex-shrink-0 hidden sm:block" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="absolute rounded-sm border"
          style={{
            width: `${72 - i * 6}px`,
            height: "10px",
            bottom: `${i * 12}px`,
            left: `${i * 3}px`,
            backgroundColor: `hsl(var(--eco-docker)/${0.06 + i * 0.04})`,
            borderColor: `hsl(var(--eco-docker)/${0.12 + i * 0.06})`,
          }}
        />
      ))}
    </div>
  );
}

export default function DockerPackagePage() {
  const params = useParams<{ "*": string }>();
  const imagePath = params["*"] ? decodeURIComponent(params["*"]) : "";
  const [tab, setTab] = useState<Tab>("overview");

  const parts = imagePath.split("/");
  const namespace = parts[0] ?? "library";
  const name = parts.slice(1).join("/") || namespace;

  const q = useQuery({
    queryKey: ["docker", "image", imagePath],
    enabled: !!imagePath,
    queryFn: () => apiGet<DockerImageInfo>(`/api/docker/image/${imagePath}`),
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
        Image not found or error loading.{" "}
        <Link to="/docker" className="underline">Back to search</Link>
      </div>
    );
  }

  const displayName = namespace === "library" ? name : `${namespace}/${name}`;
  const defaultTag = info.tags.find((t) => t.name === "latest")?.name ?? info.tags[0]?.name ?? "latest";

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "tags", label: `Tags${info.tags.length > 0 ? ` (${info.tags.length})` : ""}` },
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
        <Link to="/docker" className="hover:text-foreground transition-colors">Docker</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{displayName}</span>
      </motion.div>

      {/* Header banner */}
      <motion.div
        className="mt-3 rounded-2xl border border-border p-5 sm:p-6"
        style={{
          background: `linear-gradient(135deg, hsl(var(--eco-docker)/0.07) 0%, transparent 55%)`,
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.05 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono">{displayName}</h1>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "hsl(var(--eco-docker)/0.12)", color: ACCENT }}
              >Docker</span>
              {info.is_official && (
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "hsl(142 70% 45%/0.12)", color: "hsl(142 60% 38%)" }}
                >Official</span>
              )}
            </div>

            {/* Pull count — prominent */}
            {info.pull_count > 0 && (
              <div className="mt-2 flex items-center gap-3">
                <span className="text-lg font-semibold" style={{ color: ACCENT }}>
                  ↓ {formatPullCount(info.pull_count)}
                </span>
                <span className="text-xs text-muted-foreground">pulls</span>
                {info.star_count > 0 && (
                  <span className="text-sm text-muted-foreground">★ {info.star_count.toLocaleString()}</span>
                )}
              </div>
            )}

            {info.description && (
              <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{info.description}</p>
            )}
          </div>
          <LayerStack />
        </div>
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
          <DockerInstallBox imageName={imagePath} imageTag={defaultTag} />

          <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
            {info.pull_count > 0 && (
              <div>
                <div className="text-xs text-muted-foreground">Pulls</div>
                <div className="mt-0.5 text-sm font-semibold" style={{ color: ACCENT }}>
                  ↓ {formatPullCount(info.pull_count)}
                </div>
              </div>
            )}
            {info.star_count > 0 && (
              <div>
                <div className="text-xs text-muted-foreground">Stars</div>
                <div className="mt-0.5 text-sm">★ {info.star_count.toLocaleString()}</div>
              </div>
            )}
            {info.last_updated && (
              <div>
                <div className="text-xs text-muted-foreground">Last updated</div>
                <div className="mt-0.5 text-sm">{formatDate(info.last_updated)}</div>
              </div>
            )}
            {info.tags.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground">Tags available</div>
                <div className="mt-0.5 text-sm">{info.tags.length}</div>
              </div>
            )}
            <div className="pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground mb-0.5">Namespace</div>
              <span className="text-xs font-mono">{namespace}</span>
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
            layoutId="docker-detail-tab"
          />

          <AnimatePresence mode="wait">
            <motion.div key={tab} variants={tabVariants} initial="initial" animate="animate" exit="exit" className="mt-4">
              {tab === "overview" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-card/40 p-5">
                    <p className="text-sm text-muted-foreground">
                      {info.description || "No description available."}
                    </p>
                    {info.is_official && (
                      <div className="mt-4 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                        This is an <strong>Official Docker Image</strong> maintained by Docker, Inc.
                        Official images are a curated set of repositories hosted on Docker Hub.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === "tags" && (
                <div>
                  {info.tags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tags found.</p>
                  ) : (
                    <div className="rounded-2xl border border-border bg-card/40 overflow-hidden max-h-[28rem] overflow-y-auto">
                      {info.tags.map((tag, i) => (
                        <div key={tag.name}
                          className={`flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors ${i < info.tags.length - 1 ? "border-b border-border" : ""}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-xs">{tag.name}</span>
                            {tag.name === "latest" && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: "hsl(var(--eco-docker)/0.12)", color: ACCENT }}>
                                latest
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {tag.digest && (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-muted-foreground hidden sm:inline">
                                  {truncateDigest(tag.digest)}
                                </span>
                                <CopyButton value={tag.digest} />
                              </div>
                            )}
                            {tag.last_updated && (
                              <span className="text-[11px] text-muted-foreground hidden md:inline">
                                {formatDate(tag.last_updated)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
