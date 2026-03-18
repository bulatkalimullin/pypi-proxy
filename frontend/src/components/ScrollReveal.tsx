import React from "react";
import { motion } from "framer-motion";
import { fadeInUp } from "../lib/motion";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  /** Override direction — default is up (y: 16→0) */
  variants?: typeof fadeInUp;
}

/**
 * Wraps children in a motion.div that animates into view once when
 * the element enters the viewport. Use for all below-fold content.
 */
export function ScrollReveal({ children, className, delay, variants = fadeInUp }: ScrollRevealProps) {
  const v = delay
    ? {
        ...variants,
        visible: {
          ...variants.visible,
          transition: { ...((variants.visible as { transition?: object }).transition ?? {}), delay },
        },
      }
    : variants;

  return (
    <motion.div
      variants={v}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
