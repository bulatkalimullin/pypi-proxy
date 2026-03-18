import React from "react";
import { motion } from "framer-motion";
import { spring } from "../lib/motion";

interface Tab {
  key: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface TabBarProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  accentColor: string;
  /** Unique ID for layoutId (prevents conflicts when multiple TabBars on screen) */
  layoutId?: string;
  className?: string;
}

/**
 * Spring-animated tab bar with sliding underline indicator.
 * Replaces ~10 duplicate inline tab implementations.
 */
export function TabBar({ tabs, active, onChange, accentColor, layoutId = "tab-indicator", className = "" }: TabBarProps) {
  return (
    <div className={`relative flex gap-0 border-b border-border overflow-x-auto ${className}`}>
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm whitespace-nowrap transition-colors ${
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            style={isActive ? { color: accentColor } : {}}
          >
            {t.icon && (
              <span className="opacity-70">{t.icon}</span>
            )}
            {t.label}
            {t.count !== undefined && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={
                  isActive
                    ? { backgroundColor: `${accentColor}18`, color: accentColor }
                    : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                }
              >
                {t.count}
              </span>
            )}
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: accentColor }}
                transition={spring.tab}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
