import React, { memo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { spring } from "../lib/motion";

type Props = {
  id: string;
  name: string;
  publisher: string;
  description?: string;
  logoUrl?: string;
  rating?: number;
  installs?: number;
  verified?: boolean;
  to: string;
};

function formatInstalls(n?: number): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return `${v}`;
}

const VSCODE_COLOR = "hsl(var(--eco-vscode))";
const VSCODE_BG = "hsl(var(--eco-vscode) / 0.12)";

export const ExtensionListItem = memo(function ExtensionListItem({
  id,
  name,
  publisher,
  description,
  logoUrl,
  rating = 0,
  installs = 0,
  verified = false,
  to,
}: Props) {
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: "0 4px 24px hsl(var(--eco-vscode) / 0.15)" }}
      whileTap={{ scale: 0.97 }}
      transition={spring.snappy}
      className="h-full"
    >
      <Link
        to={to}
        className="group flex flex-col rounded-2xl border border-border bg-card/60 overflow-hidden h-full min-h-[96px] transition-colors duration-150 hover:bg-card/90 hover:border-[hsl(var(--eco-vscode)/0.5)]"
      >
        <div className="flex flex-col gap-2.5 p-3.5 flex-1">
          {/* ── Header: logo + name + publisher ── */}
          <div className="flex items-start gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${id} logo`}
                className="flex-shrink-0 w-10 h-10 rounded-xl object-cover border border-border"
                loading="lazy"
              />
            ) : (
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl border border-border flex items-center justify-center font-bold text-base select-none"
                style={{ backgroundColor: VSCODE_BG, color: VSCODE_COLOR }}
              >
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-sm text-foreground truncate leading-tight">{name}</span>
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded-md flex-shrink-0"
                  style={{ backgroundColor: VSCODE_BG, color: VSCODE_COLOR }}
                >
                  {publisher}
                </span>
                {verified && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-600 dark:text-green-400">
                    verified
                  </span>
                )}
              </div>
              {description && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{description}</p>
              )}
            </div>
          </div>

          {/* ── Footer: stats + arrow ── */}
          <div className="mt-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>★ {rating.toFixed(1)}</span>
              <span>↓ {formatInstalls(installs)}</span>
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
              style={{ color: VSCODE_COLOR }}
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Link>
    </motion.div>
  );
});
