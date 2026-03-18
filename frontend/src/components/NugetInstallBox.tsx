import React, { useMemo, useState } from "react";
import { TabBar } from "./TabBar";
import { CodeBlock } from "./CodeBlock";

type Tab = "dotnet" | "nuget_config" | "pkg_manager";

function proxyBase(): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const u = new URL(window.location.href);
  u.port = "8888";
  u.pathname = "";
  u.search = "";
  u.hash = "";
  return u.toString().replace(/\/$/, "");
}

const ACCENT = "hsl(var(--eco-nuget))";

function TerminalIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
    </svg>
  );
}

function FileIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

export function NugetInstallBox({ packageId }: { packageId: string }) {
  const [tab, setTab] = useState<Tab>("dotnet");
  const base = useMemo(() => proxyBase(), []);

  const content: Record<Tab, { code: string; filename: string; setup: boolean }> = {
    dotnet: {
      code: `dotnet add package ${packageId} \\\n  --source ${base}/nuget/v3/index.json`,
      filename: "terminal",
      setup: false,
    },
    nuget_config: {
      code: `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="pkg-proxy" value="${base}/nuget/v3/index.json" />
  </packageSources>
</configuration>`,
      filename: "NuGet.Config",
      setup: true,
    },
    pkg_manager: {
      code: `Install-Package ${packageId} -Source ${base}/nuget/v3/index.json`,
      filename: "Package Manager Console",
      setup: false,
    },
  };

  const tabs = [
    { key: "dotnet",      label: "dotnet CLI",    icon: <TerminalIcon /> },
    { key: "nuget_config", label: "NuGet.Config", icon: <FileIcon /> },
    { key: "pkg_manager", label: "pkg manager",   icon: <TerminalIcon /> },
  ];

  const current = content[tab];

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 overflow-hidden"
      style={{}}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="text-sm font-semibold">Install via proxy</div>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: "hsl(var(--eco-nuget)/0.10)", color: ACCENT }}>
          NuGet
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">NuGet registry proxy with server-side caching.</p>

      <TabBar
        tabs={tabs}
        active={tab}
        onChange={(k) => setTab(k as Tab)}
        accentColor={ACCENT}
        layoutId="nuget-tab"
      />

      <div className="mt-2 flex items-center gap-2">
        {current.setup ? (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
            Configure once
          </span>
        ) : (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
            Per-command
          </span>
        )}
        {tab === "nuget_config" && (
          <span className="text-[10px] text-muted-foreground">
            Place in solution root or <code className="font-mono">%APPDATA%\NuGet\</code>
          </span>
        )}
      </div>

      <CodeBlock
        content={current.code}
        filename={current.filename}
        language={tab === "nuget_config" ? "xml" : "bash"}
      />
    </div>
  );
}
