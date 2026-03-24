import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import { ThemeToggle } from "./ThemeToggle";
import { routeVariants } from "../lib/motion";

type EcoId = "python" | "npm" | "nuget" | "docker" | "js" | "vscode";

const EcosystemNav: {
  to: string;
  label: string;
  id: EcoId;
  icon: React.ReactNode;
  match: (p: string) => boolean;
}[] = [
  {
    to: "/",
    id: "python",
    label: "Python",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.007 2.752h5.814v.826H3.89S0 5.789 0 11.969c0 6.18 3.403 5.96 3.403 5.96h2.031v-2.867s-.11-3.404 3.347-3.404h5.765s3.236.052 3.236-3.128V3.128S18.28 0 11.914 0zM8.708 1.81a1.044 1.044 0 1 1 0 2.086 1.044 1.044 0 0 1 0-2.086z"/>
        <path d="M12.086 24c6.094 0 5.714-2.656 5.714-2.656l-.007-2.752H12v-.826h8.11S24 18.211 24 12.031c0-6.18-3.403-5.96-3.403-5.96h-2.031v2.867s.11 3.404-3.347 3.404H9.454s-3.236-.052-3.236 3.128v5.402S5.72 24 12.086 24zm3.206-1.81a1.044 1.044 0 1 1 0-2.086 1.044 1.044 0 0 1 0 2.086z"/>
      </svg>
    ),
    match: (p) => p === "/" || p.startsWith("/package"),
  },
  {
    to: "/npm",
    id: "npm",
    label: "npm",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M0 0v24h24V0H0zm6 18H4V6h2v12zm4-6H8V6h8v12h-4v-6h-2v6z"/>
      </svg>
    ),
    match: (p) => p.startsWith("/npm"),
  },
  {
    to: "/nuget",
    id: "nuget",
    label: "NuGet",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19.765 6.782L12 2.25 4.235 6.782v9.064L12 20.378l7.765-4.532V6.782zm-7.765 9.544l-5.765-3.364V8.3L12 4.936l5.765 3.364v4.662L12 16.326z"/>
      </svg>
    ),
    match: (p) => p.startsWith("/nuget"),
  },
  {
    to: "/docker",
    id: "docker",
    label: "Docker",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.186.186 0 0 0-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.186.186 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.185.186v1.887c0 .102.083.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/>
      </svg>
    ),
    match: (p) => p.startsWith("/docker"),
  },
  {
    to: "/extensions",
    id: "vscode",
    label: "VS Code",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16.98 2 6.34 12.1l3.42 3.2L19.4 6v12l-9.64-9.3-3.42 3.2L16.98 22 22 20V4l-5.02-2zM2 12l2.86-2.55 2.11 2.04-2.1 2.04L2 12z" />
      </svg>
    ),
    match: (p) => p.startsWith("/extensions"),
  },
  {
    to: "/js-libraries",
    id: "js",
    label: "JS",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M2 3h20v18H2V3zm11.2 13.53c.42.7 1.03 1.21 2.07 1.21 1.09 0 1.78-.55 1.78-1.31 0-.91-.72-1.23-1.94-1.76l-.67-.29c-1.93-.82-3.2-1.85-3.2-4.02 0-2 1.52-3.52 3.9-3.52 1.69 0 2.9.59 3.77 2.12l-2.07 1.33c-.46-.82-.95-1.14-1.7-1.14-.77 0-1.26.49-1.26 1.14 0 .8.49 1.12 1.62 1.61l.67.29c2.27.97 3.54 1.96 3.54 4.19 0 2.4-1.88 3.71-4.41 3.71-2.47 0-4.06-1.18-4.84-2.73l2.14-1.23zM7.57 16.58c.43.77.82 1.42 1.76 1.42.9 0 1.47-.35 1.47-1.72V7h2.73v9.32c0 2.83-1.66 4.12-4.08 4.12-2.18 0-3.43-1.12-4.08-2.47l2.2-1.39z" />
      </svg>
    ),
    match: (p) => p.startsWith("/js-libraries"),
  },
];

function GearIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

export function AppShell() {
  const location = useLocation();

  return (
    <div className="min-h-screen">
      {/* ── Sticky header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0 flex items-center gap-2 font-semibold tracking-tight">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-primary">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <span className="hidden sm:inline">Pkg Proxy</span>
          </Link>

          {/* Desktop ecosystem nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {EcosystemNav.map((item) => {
              const active = item.match(location.pathname);
              const color = `hsl(var(--eco-${item.id}))`;
              const bg = `hsl(var(--eco-${item.id}) / 0.10)`;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-all duration-150"
                  style={active
                    ? { backgroundColor: bg, color }
                    : {}}
                >
                  <span
                    className={`transition-colors ${active ? "" : "text-muted-foreground"}`}
                    style={active ? { color } : {}}
                  >
                    {item.icon}
                  </span>
                  <span className={active ? "font-medium" : "text-muted-foreground hover:text-foreground"}>
                    {item.label}
                  </span>
                </Link>
              );
            })}

            <span className="mx-1.5 h-4 w-px bg-border" />

            <Link
              to="/admin"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                location.pathname.startsWith("/admin")
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
              title="Admin"
            >
              <GearIcon />
              <span>Admin</span>
            </Link>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Page content with route transition ────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          variants={routeVariants}
          initial="initial"
          animate="enter"
          exit="exit"
          className="mx-auto max-w-[1400px] px-4 py-8 pb-20 md:pb-8"
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>

      {/* ── Mobile bottom navigation bar ──────────────────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-20 md:hidden border-t border-border bg-background/95 backdrop-blur-md safe-area-pb">
        <div className="flex items-center justify-around h-14 px-1">
          {EcosystemNav.map((item) => {
            const active = item.match(location.pathname);
            const color = `hsl(var(--eco-${item.id}))`;
            const bg = `hsl(var(--eco-${item.id}) / 0.10)`;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[56px]"
              >
                {active && (
                  <motion.div
                    layoutId="bottom-nav-pill"
                    className="absolute inset-0 rounded-xl"
                    style={{ backgroundColor: bg }}
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                  />
                )}
                <span
                  className="relative z-10 transition-colors"
                  style={{ color: active ? color : undefined }}
                >
                  {item.icon}
                </span>
                <span
                  className="relative z-10 text-[10px] font-medium transition-colors"
                  style={{ color: active ? color : "hsl(var(--muted-foreground))" }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
          <Link
            to="/admin"
            className="relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[56px]"
          >
            {location.pathname.startsWith("/admin") && (
              <motion.div
                layoutId="bottom-nav-pill"
                className="absolute inset-0 rounded-xl bg-muted"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <span className="relative z-10 text-muted-foreground">
              <GearIcon />
            </span>
            <span className="relative z-10 text-[10px] font-medium text-muted-foreground">Admin</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
