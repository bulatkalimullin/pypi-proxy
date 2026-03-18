from __future__ import annotations

import json
import time
from pathlib import Path
from threading import Lock


class DownloadStats:
    """Tracks download counts per package, persisted to a JSON file."""

    def __init__(self, stats_path: Path) -> None:
        self._path = stats_path
        self._lock = Lock()
        self._counts: dict[str, int] = {}
        self._started_at: float = time.time()
        self._load()

    def _load(self) -> None:
        if self._path.is_file():
            try:
                data = json.loads(self._path.read_text(encoding="utf-8"))
                self._counts = {str(k): int(v) for k, v in data.get("counts", {}).items()}
                self._started_at = float(data.get("started_at", self._started_at))
            except Exception:
                self._counts = {}

    def _save(self) -> None:
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            payload = {"started_at": self._started_at, "counts": self._counts}
            self._path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        except Exception:
            pass

    def record(self, package: str) -> None:
        with self._lock:
            self._counts[package] = self._counts.get(package, 0) + 1
            self._save()

    def get(self, package: str) -> int:
        with self._lock:
            return self._counts.get(package, 0)

    def all_counts(self) -> dict[str, int]:
        with self._lock:
            return dict(self._counts)

    def started_at(self) -> float:
        return self._started_at

    def reset(self, package: str | None = None) -> None:
        with self._lock:
            if package:
                self._counts.pop(package, None)
            else:
                self._counts.clear()
            self._save()
