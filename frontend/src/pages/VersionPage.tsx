import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";

import { apiGet, PyPIVersionJson } from "../lib/api";
import { Skeleton } from "../components/ui/skeleton";
import { useToast } from "../contexts/ToastContext";

function backendBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const u = new URL(window.location.href);
  u.port = "8888";
  u.pathname = "";
  u.search = "";
  u.hash = "";
  return u.toString().replace(/\/$/, "");
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
};
const rowItem = {
  initial: { opacity: 0, x: -6 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.18 } },
};

export default function VersionPage() {
  const params = useParams();
  const name = params.name ? decodeURIComponent(params.name) : "";
  const version = params.version ? decodeURIComponent(params.version) : "";
  const { toast } = useToast();

  const q = useQuery({
    queryKey: ["version", name, version],
    enabled: !!name && !!version,
    queryFn: () => apiGet<PyPIVersionJson>(`/api/package/${encodeURIComponent(name)}/${encodeURIComponent(version)}`),
    staleTime: 60_000,
  });

  const info = q.data?.info ?? {};
  const urls = q.data?.urls ?? [];

  const handleCopyInstall = () => {
    const base = backendBaseUrl();
    const host = new URL(base).hostname;
    const cmd = `pip install --index-url ${base}/simple --trusted-host ${host} ${name}==${version}`;
    void navigator.clipboard.writeText(cmd);
    toast("Install command copied!", "success");
  };

  return (
    <div>
      {/* Breadcrumbs */}
      <motion.div
        className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap"
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        {[
          { label: "Search", to: "/" },
          { label: name, to: `/package/${encodeURIComponent(name)}` },
          { label: version, to: null },
        ].map((crumb, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span>/</span>}
            {crumb.to ? (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}>
                <Link to={crumb.to} className="hover:text-foreground transition-colors">{crumb.label}</Link>
              </motion.span>
            ) : (
              <motion.span className="text-foreground font-medium" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}>
                {crumb.label}
              </motion.span>
            )}
          </React.Fragment>
        ))}
      </motion.div>

      <motion.div
        className="mt-3 flex items-start justify-between gap-3 flex-wrap"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.04 }}
      >
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            {name} <span className="text-muted-foreground font-normal">{version}</span>
          </h1>
          {info.summary ? <div className="mt-1 text-sm text-muted-foreground">{info.summary}</div> : null}
        </div>
        <div className="flex gap-2 flex-wrap">
          <motion.button
            onClick={handleCopyInstall}
            className="rounded-lg border border-border bg-card/40 px-3 sm:px-4 py-2 text-sm hover:bg-muted/60 transition-colors"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            Copy pip install
          </motion.button>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              to={`/package/${encodeURIComponent(name)}`}
              className="flex rounded-lg border border-border bg-card/40 px-3 sm:px-4 py-2 text-sm hover:bg-muted/60 transition-colors"
            >
              All versions
            </Link>
          </motion.div>
        </div>
      </motion.div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.08 }}
        >
          <div className="rounded-2xl border border-border bg-card/40 p-4">
            <div className="text-sm font-medium">Files</div>

            {q.isLoading ? (
              <div className="mt-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : q.isError ? (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {String(q.error)}
              </div>
            ) : urls.length === 0 ? (
              <div className="mt-3 text-sm text-muted-foreground">No files available.</div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm min-w-[360px]">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-xs">Filename</th>
                      <th className="px-4 py-2.5 text-left font-medium text-xs hidden sm:table-cell">Type</th>
                      <th className="px-4 py-2.5 text-right font-medium text-xs">Size</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <motion.tbody
                    className="divide-y divide-border"
                    variants={staggerContainer}
                    initial="initial"
                    animate="animate"
                  >
                    {urls.map((u) => (
                      <motion.tr
                        key={u.filename ?? Math.random()}
                        variants={rowItem}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs max-w-[140px] sm:max-w-[240px] truncate" title={u.filename}>
                          {u.filename}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                          <span className={`rounded px-1.5 py-0.5 ${
                            u.packagetype === "bdist_wheel"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted/60 text-muted-foreground"
                          }`}>
                            {u.packagetype === "bdist_wheel" ? "wheel" : u.packagetype ?? "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {typeof u.size === "number" ? `${Math.round(u.size / 1024)} KB` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {u.filename ? (
                            <motion.a
                              className="inline-block rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity whitespace-nowrap"
                              href={`${backendBaseUrl()}/download/${encodeURIComponent(name)}/${encodeURIComponent(version)}/${encodeURIComponent(u.filename)}`}
                              target="_blank"
                              rel="noreferrer"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              Download
                            </motion.a>
                          ) : null}
                        </td>
                      </motion.tr>
                    ))}
                  </motion.tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: 0.12 }}
        >
          <div className="rounded-2xl border border-border bg-card/40 p-4">
            <div className="text-sm font-medium">Metadata</div>
            {q.isLoading ? (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="mt-3 space-y-3 text-sm">
                {info.license ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">License</span>
                    <span className="text-foreground">{info.license}</span>
                  </div>
                ) : null}
                {info.requires_python ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Python requires</span>
                    <span className="text-foreground font-mono text-xs">{info.requires_python}</span>
                  </div>
                ) : null}
                {info.requires_dist && info.requires_dist.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">Dependencies ({info.requires_dist.length})</span>
                    <div className="max-h-32 overflow-auto rounded-lg border border-border">
                      {info.requires_dist.map((d, i) => (
                        <div key={i} className="border-b border-border last:border-0 px-2.5 py-1.5 text-xs font-mono text-muted-foreground">
                          {d}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="pt-2 border-t border-border flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Backend</span>
                  <span className="text-xs text-foreground font-mono break-all">{backendBaseUrl()}</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
