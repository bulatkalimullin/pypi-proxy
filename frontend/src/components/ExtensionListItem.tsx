import React from "react";
import { Link } from "react-router-dom";

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

export function ExtensionListItem({
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
    <Link to={to} className="block rounded-2xl border border-border bg-card/60 p-3.5 hover:bg-card/90 transition-colors">
      <div className="flex items-start gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt={`${id} logo`} className="w-10 h-10 rounded-lg object-cover border border-border" loading="lazy" />
        ) : (
          <div className="w-10 h-10 rounded-lg border border-border bg-muted/50 flex items-center justify-center text-xs font-semibold">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm truncate">{name}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">{publisher}</span>
            {verified && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">verified</span>
            )}
          </div>
          {description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{description}</p>}
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>★ {rating.toFixed(1)}</span>
            <span>↓ {formatInstalls(installs)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
