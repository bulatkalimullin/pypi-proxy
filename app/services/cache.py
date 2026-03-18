from __future__ import annotations

import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional


def _safe_segment(value: str) -> str:
    v = value.strip()
    v = re.sub(r"[^\w.\-+]+", "_", v, flags=re.UNICODE)
    v = v.strip("._")
    return v or "_"


@dataclass
class CacheEntry:
    value: Any
    expires_at: float


class MetadataCache:
    def __init__(self, ttl_seconds: int) -> None:
        self._ttl = max(1, int(ttl_seconds))
        self._store: dict[str, CacheEntry] = {}

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if not entry:
            return None
        if entry.expires_at < time.time():
            self._store.pop(key, None)
            return None
        return entry.value

    def set(self, key: str, value: Any) -> None:
        self._store[key] = CacheEntry(value=value, expires_at=time.time() + self._ttl)


class FileCache:
    def __init__(self, root_dir: Path) -> None:
        self.root_dir = Path(root_dir)
        self.root_dir.mkdir(parents=True, exist_ok=True)

    def path_for(self, package: str, version: str, filename: str) -> Path:
        return (
            self.root_dir
            / _safe_segment(package)
            / _safe_segment(version)
            / _safe_segment(filename)
        )

    def has(self, package: str, version: str, filename: str) -> bool:
        return self.path_for(package, version, filename).is_file()

    def ensure_parent(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)

