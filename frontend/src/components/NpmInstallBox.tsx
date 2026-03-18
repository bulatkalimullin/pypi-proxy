import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TabBar } from "./TabBar";
import { CodeBlock } from "./CodeBlock";
import { spring } from "../lib/motion";

type Tab = "npm" | "npmrc" | "package_json";

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

const ACCENT = "hsl(var(--eco-npm))";

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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      animate={{ rotate: open ? 180 : 0 }}
      transition={spring.snappy}
    >
      <polyline points="6 9 12 15 18 9"/>
    </motion.svg>
  );
}

export function NpmInstallBox({ packageName }: { packageName: string }) {
  const [tab, setTab] = useState<Tab>("npm");
  const [showAlternatives, setShowAlternatives] = useState(false);
  const base = useMemo(() => proxyBase(), []);

  const npmCmd = `npm install --registry ${base}/npm/ ${packageName}`;
  const npmrc = `registry=${base}/npm/`;
  const pkgJson = `"publishConfig": {\n  "registry": "${base}/npm/"\n}`;
  const yarnCmd = `yarn add --registry ${base}/npm/ ${packageName}`;
  const pnpmCmd = `pnpm add --registry ${base}/npm/ ${packageName}`;

  const content: Record<Tab, { code: string; filename: string; setup: boolean }> = {
    npm:        { code: npmCmd,  filename: "terminal", setup: false },
    npmrc:      { code: npmrc,   filename: ".npmrc",   setup: true  },
    package_json: { code: pkgJson, filename: "package.json", setup: true },
  };

  const tabs = [
    { key: "npm",          label: "npm install",  icon: <TerminalIcon /> },
    { key: "npmrc",        label: ".npmrc",       icon: <FileIcon /> },
    { key: "package_json", label: "package.json", icon: <FileIcon /> },
  ];

  const current = content[tab];

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 overflow-hidden"
      style={{}}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="text-sm font-semibold">Install via proxy</div>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: "hsl(var(--eco-npm)/0.10)", color: ACCENT }}>
          npm
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">npm registry proxy with server-side caching.</p>

      <TabBar
        tabs={tabs}
        active={tab}
        onChange={(k) => setTab(k as Tab)}
        accentColor={ACCENT}
        layoutId="npm-tab"
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
      </div>

      <CodeBlock content={current.code} filename={current.filename} language="bash" />

      {/* yarn / pnpm alternatives — collapsed by default */}
      {tab === "npm" && (
        <div className="mt-3">
          <button
            onClick={() => setShowAlternatives((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronIcon open={showAlternatives} />
            Also works with yarn / pnpm
          </button>
          <AnimatePresence>
            {showAlternatives && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-2">
                  <CodeBlock content={yarnCmd} filename="yarn" language="bash" />
                  <CodeBlock content={pnpmCmd} filename="pnpm" language="bash" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
