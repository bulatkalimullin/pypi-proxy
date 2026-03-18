import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { spring } from "../lib/motion";
import { useToast } from "../contexts/ToastContext";

interface CodeBlockProps {
  content: string;
  filename?: string;
  language?: string;
  className?: string;
}

function ClipboardIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
      <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
      <path d="M16 4h2a2 2 0 0 1 2 2v4"/>
      <path d="M21 14H11"/>
      <path d="m15 10-4 4 4 4"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

/**
 * Code block with always-visible copy button, filename badge, and
 * AnimatePresence cross-dissolve when content changes.
 */
export function CodeBlock({ content, filename, language: _language, className = "" }: CodeBlockProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      toast("Copied to clipboard!", "success");
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  }, [content, toast]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div className={`relative mt-3 rounded-xl border border-border bg-background overflow-hidden ${className}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
        {filename ? (
          <span className="text-[10px] font-mono text-muted-foreground">{filename}</span>
        ) : (
          <span />
        )}
        <motion.button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          {...spring.snappy}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.93 }}
          aria-label="Copy to clipboard"
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span
                key="check"
                className="text-green-500"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
              >
                <CheckIcon />
              </motion.span>
            ) : (
              <motion.span
                key="clip"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
              >
                <ClipboardIcon />
              </motion.span>
            )}
          </AnimatePresence>
          {copied ? "Copied!" : "Copy"}
        </motion.button>
      </div>

      {/* Code content — cross-dissolve on change */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.pre
          key={content}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="overflow-auto p-3 text-xs text-foreground leading-relaxed font-mono"
        >
          {content}
        </motion.pre>
      </AnimatePresence>
    </div>
  );
}
