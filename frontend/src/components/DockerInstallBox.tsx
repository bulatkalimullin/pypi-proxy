import React, { useMemo, useState } from "react";
import { TabBar } from "./TabBar";
import { CodeBlock } from "./CodeBlock";

type Tab = "pull" | "compose" | "dockerfile" | "daemon" | "buildx";

function proxyHost(): string {
  // In production, commands must point to the public site host.
  if (typeof window !== "undefined") {
    const webHost = window.location.host;
    const isLocalHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(webHost);
    if (webHost && !isLocalHost) {
      return webHost;
    }
  }

  const fromEnv = import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined;
  const raw = fromEnv ? fromEnv.replace(/\/$/, "") : "";
  // Docker needs host:port without protocol
  try {
    const u = new URL(raw.startsWith("http") ? raw : `http://${raw}`);
    return u.host;
  } catch {
    return raw || "localhost:8888";
  }
}

const ACCENT = "hsl(var(--eco-docker))";

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

function SettingsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

export function DockerInstallBox({
  imageName = "library/nginx",
  imageTag = "latest",
}: {
  imageName?: string;
  imageTag?: string;
}) {
  const [tab, setTab] = useState<Tab>("pull");
  const host = useMemo(() => proxyHost(), []);

  const fullImage = `${host}/${imageName}:${imageTag}`;

  const content: Record<Tab, { code: string; filename: string; setup: boolean }> = {
    pull: {
      code: `docker pull ${fullImage}`,
      filename: "terminal",
      setup: false,
    },
    compose: {
      code: `services:\n  app:\n    image: ${fullImage}`,
      filename: "docker-compose.yml",
      setup: false,
    },
    dockerfile: {
      code: `FROM ${fullImage}`,
      filename: "Dockerfile",
      setup: false,
    },
    daemon: {
      code: `{\n  "registry-mirrors": ["http://${host}"]\n}`,
      filename: "daemon.json",
      setup: true,
    },
    buildx: {
      code: `docker buildx create \\\n  --driver-opt "mirror=${host}" \\\n  --name proxy-builder\ndocker buildx use proxy-builder`,
      filename: "terminal",
      setup: false,
    },
  };

  const tabs = [
    { key: "pull",       label: "docker pull",        icon: <TerminalIcon /> },
    { key: "compose",    label: "docker-compose.yml", icon: <FileIcon /> },
    { key: "dockerfile", label: "Dockerfile",         icon: <FileIcon /> },
    { key: "daemon",     label: "daemon.json",        icon: <SettingsIcon /> },
    { key: "buildx",     label: "buildx",             icon: <TerminalIcon /> },
  ];

  const current = content[tab];

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 overflow-hidden"
      style={{}}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="text-sm font-semibold">Pull via proxy</div>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: "hsl(var(--eco-docker)/0.10)", color: ACCENT }}>
          Docker
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">Pull-through cache — layers stored on disk per digest.</p>

      <TabBar
        tabs={tabs}
        active={tab}
        onChange={(k) => setTab(k as Tab)}
        accentColor={ACCENT}
        layoutId="docker-tab"
      />

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {current.setup ? (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
            Configure once
          </span>
        ) : (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
            Per-command
          </span>
        )}
      </div>

      {tab === "daemon" && (
        <div className="mt-2 flex gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <div className="text-xs text-muted-foreground">
            Place in <code className="font-mono">/etc/docker/daemon.json</code> and restart Docker.
            All <code className="font-mono">docker pull</code> commands will automatically route through this proxy.
          </div>
        </div>
      )}

      {tab === "buildx" && (
        <div className="mt-2 flex gap-2 rounded-lg border border-border bg-amber-500/5 px-3 py-2">
          <div className="text-xs text-muted-foreground">
            This creates a new buildx builder named <code className="font-mono">proxy-builder</code> and sets it as active for multi-platform builds.
          </div>
        </div>
      )}

      <CodeBlock
        content={current.code}
        filename={current.filename}
        language={tab === "compose" ? "yaml" : tab === "daemon" ? "json" : "bash"}
      />
    </div>
  );
}
