import React from "react";
import { cx } from "../../lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-muted", className)} />;
}

