import type { Transition, Variants } from "framer-motion";

// ── Spring presets ─────────────────────────────────────────────────────────────

export const spring = {
  snappy:  { type: "spring" as const, stiffness: 500, damping: 30 },
  bouncy:  { type: "spring" as const, stiffness: 300, damping: 20 },
  gentle:  { type: "spring" as const, stiffness: 200, damping: 28 },
  tab:     { type: "spring" as const, stiffness: 450, damping: 32 },
} satisfies Record<string, Transition>;

// ── Tween presets ──────────────────────────────────────────────────────────────

export const tween = {
  fast: { duration: 0.12, ease: "easeOut" as const },
  base: { duration: 0.20, ease: "easeOut" as const },
  slow: { duration: 0.35, ease: "easeOut" as const },
} satisfies Record<string, Transition>;

// ── Variant presets ────────────────────────────────────────────────────────────

/** Scroll-reveal: fade up from below */
export const fadeInUp: Variants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: tween.base },
};

/** Stagger container — children animate sequentially */
export function staggerContainer(stagger = 0.045): Variants {
  return {
    hidden:   {},
    visible:  { transition: { staggerChildren: stagger } },
  };
}

/** Child item for stagger lists */
export const staggerItem: Variants = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: tween.base },
};

/** Page route transition */
export const routeVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  enter:   { opacity: 1, y: 0, transition: tween.base },
  exit:    { opacity: 0, y: -4, transition: tween.fast },
};

/** Tab content transition */
export const tabVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: tween.base },
  exit:    { opacity: 0, y: -4, transition: tween.fast },
};

/** Skeleton → content cross-dissolve */
export const dissolveVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, delay: 0.06 } },
  exit:    { opacity: 0, transition: { duration: 0.12 } },
};

// ── Interactive motion props (spread onto motion.div) ─────────────────────────

/** Hover lift: element rises 2px + shadow deepens */
export const hoverLift = {
  whileHover: { y: -2, boxShadow: "0 6px 20px rgba(0,0,0,0.10)" },
  whileTap:   { scale: 0.97 },
  transition: spring.snappy,
} as const;

/** Subtle hover — for smaller interactive elements */
export const hoverSubtle = {
  whileHover: { scale: 1.04 },
  whileTap:   { scale: 0.94 },
  transition: spring.snappy,
} as const;
