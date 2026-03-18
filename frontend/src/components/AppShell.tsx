import React from "react";
import { Link, Outlet } from "react-router-dom";
import { motion } from "framer-motion";

export function AppShell() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="font-semibold tracking-tight">
            PyPI Web UI
          </Link>
          <div className="text-xs text-muted-foreground">
            pip index: <span className="text-foreground">/simple</span>
          </div>
        </div>
      </header>
      <motion.main
        className="mx-auto max-w-5xl px-4 py-8"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Outlet />
      </motion.main>
    </div>
  );
}

