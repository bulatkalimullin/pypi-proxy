import React from "react";

export type EcosystemId = "python" | "npm" | "nuget" | "docker" | "vscode";

const CONFIGS: Record<EcosystemId, { label: string; cssVar: string; icon: React.ReactNode }> = {
  python: {
    label: "Python",
    cssVar: "--eco-python",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" flexShrink={0}>
        <path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.007 2.752h5.814v.826H3.89S0 5.789 0 11.969c0 6.18 3.403 5.96 3.403 5.96h2.031v-2.867s-.11-3.404 3.347-3.404h5.765s3.236.052 3.236-3.128V3.128S18.28 0 11.914 0zM8.708 1.81a1.044 1.044 0 0 1 1.044 1.043 1.044 1.044 0 0 1-1.044 1.043 1.044 1.044 0 0 1-1.043-1.043A1.044 1.044 0 0 1 8.708 1.81z"/>
        <path d="M12.086 24c6.094 0 5.714-2.656 5.714-2.656l-.007-2.752H12v-.826h8.11S24 18.211 24 12.031c0-6.18-3.403-5.96-3.403-5.96h-2.031v2.867s.11 3.404-3.347 3.404H9.454s-3.236-.052-3.236 3.128v5.402S5.72 24 12.086 24zm3.206-1.81a1.044 1.044 0 0 1-1.044-1.043 1.044 1.044 0 0 1 1.044-1.043 1.044 1.044 0 0 1 1.043 1.043 1.044 1.044 0 0 1-1.043 1.043z"/>
      </svg>
    ),
  },
  npm: {
    label: "npm",
    cssVar: "--eco-npm",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M0 0v24h24V0H0zm6 18H4V6h2v12zm4-6H8V6h8v12h-4v-6h-2v6z"/>
      </svg>
    ),
  },
  nuget: {
    label: "NuGet",
    cssVar: "--eco-nuget",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19.765 6.782L12 2.25 4.235 6.782v9.064L12 20.378l7.765-4.532V6.782zm-7.765 9.544l-5.765-3.364V8.3L12 4.936l5.765 3.364v4.662L12 16.326z"/>
      </svg>
    ),
  },
  docker: {
    label: "Docker",
    cssVar: "--eco-docker",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.186.186 0 0 0-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.186.186 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.185.186v1.887c0 .102.083.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/>
      </svg>
    ),
  },
  vscode: {
    label: "VS Code",
    cssVar: "--eco-vscode",
    icon: (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16.98 2 6.34 12.1l3.42 3.2L19.4 6v12l-9.64-9.3-3.42 3.2L16.98 22 22 20V4l-5.02-2zM2 12l2.86-2.55 2.11 2.04-2.1 2.04L2 12z" />
      </svg>
    ),
  },
};

interface EcosystemBadgeProps {
  ecosystem: EcosystemId;
  size?: "sm" | "md";
  className?: string;
}

export function EcosystemBadge({ ecosystem, size = "sm", className = "" }: EcosystemBadgeProps) {
  const cfg = CONFIGS[ecosystem];
  const color = `hsl(var(${cfg.cssVar}))`;
  const bg = `hsl(var(${cfg.cssVar}) / 0.12)`;

  const sizeClasses = size === "sm"
    ? "text-[10px] px-1.5 py-0.5 gap-1"
    : "text-xs px-2 py-1 gap-1.5";

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${sizeClasses} ${className}`}
      style={{ backgroundColor: bg, color }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

/** Returns the CSS color string for an ecosystem */
export function ecoColor(ecosystem: EcosystemId): string {
  return `hsl(var(--eco-${ecosystem}))`;
}

/** Returns the CSS background string at given opacity */
export function ecoBg(ecosystem: EcosystemId, opacity = 0.12): string {
  return `hsl(var(--eco-${ecosystem}) / ${opacity})`;
}
