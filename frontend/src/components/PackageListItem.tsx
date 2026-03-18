import React from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { spring } from "../lib/motion";
import type { EcosystemId } from "./EcosystemBadge";
import { ecoColor, ecoBg } from "./EcosystemBadge";

interface PackageListItemProps {
  name: string;
  version?: string;
  description?: string;
  to: string;
  ecosystem: EcosystemId;
  cached?: boolean;
  /** Shows shimmer skeleton for version + description (while lazy-loading) */
  loading?: boolean;
  /** Extra right-side info */
  meta?: React.ReactNode;
  /** Highlight when keyboard-focused */
  focused?: boolean;
}

export function PackageListItem({
  name, version, description, to, ecosystem, cached, loading, meta, focused,
}: PackageListItemProps) {
  const color = ecoColor(ecosystem);
  const avatarBg = ecoBg(ecosystem, 0.16);
  const hoverBorder = `hsl(var(--eco-${ecosystem}) / 0.5)`;
  const hoverShadow = `0 4px 24px hsl(var(--eco-${ecosystem}) / 0.15)`;

  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: hoverShadow }}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
      className="h-full"
    >
      <Link
        to={to}
        className={`group flex flex-col rounded-2xl border bg-card/60 overflow-hidden h-full min-h-[116px] transition-colors duration-150
          hover:bg-card/90
          ${focused ? "ring-2 ring-offset-1 border-transparent" : "border-border hover:border-[var(--eco-hover)]"}
        `}
        style={{
          ["--eco-hover" as string]: hoverBorder,
          ...(focused ? { outlineColor: color, borderColor: color } : {}),
        }}
      >
        <div className="flex flex-col gap-2.5 p-3.5 flex-1">

          {/* ── Header: avatar + name + version ── */}
          <div className="flex items-start gap-3">
            {/* Initial-letter avatar */}
            <div
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base select-none"
              style={{ backgroundColor: avatarBg, color }}
            >
              {name[0]?.toUpperCase() ?? "?"}
            </div>

            <div className="min-w-0 flex-1">
              {/* Name row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-semibold text-sm text-foreground truncate leading-tight">
                  {name}
                </span>
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.span
                      key="skeleton"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-4 w-10 rounded bg-muted animate-pulse flex-shrink-0"
                    />
                  ) : version ? (
                    <motion.span
                      key="version"
                      initial={{ opacity: 0, scale: 0.88 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={spring.snappy}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded-md flex-shrink-0"
                      style={{ backgroundColor: avatarBg, color }}
                    >
                      v{version}
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </div>

              {/* Description */}
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div
                    key="desc-skeleton"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-1.5 space-y-1"
                  >
                    <div className="h-2.5 w-full rounded bg-muted animate-pulse" />
                    <div className="h-2.5 w-3/4 rounded bg-muted animate-pulse" />
                  </motion.div>
                ) : description ? (
                  <motion.p
                    key="desc"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed"
                  >
                    {description}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Footer: cached + meta + arrow ── */}
          <div className="mt-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {cached && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                  cached
                </span>
              )}
              {meta && (
                <span className="text-xs text-muted-foreground">{meta}</span>
              )}
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-25 group-hover:opacity-60 transition-opacity flex-shrink-0"
              style={{ color }}
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
