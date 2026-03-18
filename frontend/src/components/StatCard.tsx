import React from "react";
import { motion } from "framer-motion";
import { ScrollReveal } from "./ScrollReveal";
import { hoverLift } from "../lib/motion";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  color?: string;
  index?: number;
}

/**
 * Admin dashboard stat card with optional ecosystem color accent.
 * Extracted from AdminPage for reuse and viewport-triggered entry.
 */
export function StatCard({ label, value, sub, icon, color, index = 0 }: StatCardProps) {
  return (
    <ScrollReveal delay={index * 0.06}>
      <motion.div
        {...hoverLift}
        className="rounded-2xl border border-border bg-card/60 p-5 overflow-hidden relative"
        style={{}}
      >
        {/* Subtle background tint */}
        {color && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `linear-gradient(135deg, ${color}08 0%, transparent 60%)` }}
          />
        )}
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            {icon && (
              <div style={color ? { color } : { color: "hsl(var(--muted-foreground))" }}>
                {icon}
              </div>
            )}
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium ml-auto">
              {label}
            </span>
          </div>
          <div
            className="text-2xl font-bold tabular-nums tracking-tight"
            style={color ? { color } : undefined}
          >
            {value}
          </div>
          {sub && (
            <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
          )}
        </div>
      </motion.div>
    </ScrollReveal>
  );
}
