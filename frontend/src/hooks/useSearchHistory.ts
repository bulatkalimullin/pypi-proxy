import { useCallback, useEffect, useState } from "react";

const MAX_ITEMS = 10;

function load(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function save(key: string, items: string[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

/**
 * @param storageKey - unique localStorage key per ecosystem (default: "search_history")
 */
export function useSearchHistory(storageKey = "search_history") {
  const [history, setHistory] = useState<string[]>(() => load(storageKey));

  useEffect(() => {
    save(storageKey, history);
  }, [history, storageKey]);

  const addQuery = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const filtered = prev.filter((q) => q !== trimmed);
      return [trimmed, ...filtered].slice(0, MAX_ITEMS);
    });
  }, []);

  const removeQuery = useCallback((query: string) => {
    setHistory((prev) => prev.filter((q) => q !== query));
  }, []);

  const clear = useCallback(() => setHistory([]), []);

  return { history, addQuery, removeQuery, clear };
}
