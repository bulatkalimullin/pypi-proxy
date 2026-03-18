import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pinned_packages";

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function save(packages: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
}

export function usePinnedPackages() {
  const [pinned, setPinned] = useState<string[]>(load);

  useEffect(() => {
    save(pinned);
  }, [pinned]);

  const toggle = useCallback((name: string) => {
    setPinned((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  }, []);

  const isPinned = useCallback((name: string) => pinned.includes(name), [pinned]);

  const remove = useCallback((name: string) => {
    setPinned((prev) => prev.filter((p) => p !== name));
  }, []);

  return { pinned, toggle, isPinned, remove };
}
