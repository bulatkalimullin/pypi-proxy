from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import httpx


@dataclass(frozen=True)
class SimpleIndexSettings:
    base_url: str
    cache_path: Path
    ttl_seconds: int


class SimpleIndex:
    def __init__(self, settings: SimpleIndexSettings) -> None:
        self._settings = settings

    @property
    def cache_path(self) -> Path:
        return self._settings.cache_path

    def _is_fresh(self) -> bool:
        p = self._settings.cache_path
        if not p.exists():
            return False
        age = time.time() - p.stat().st_mtime
        return age < max(1, int(self._settings.ttl_seconds))

    async def ensure_updated(self) -> None:
        if self._is_fresh():
            return
        await self.refresh()

    async def refresh(self) -> None:
        url = f"{self._settings.base_url.rstrip('/')}/simple/"
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(60.0),
            follow_redirects=True,
            headers={
                "User-Agent": "pypi-web-ui/0.1",
                "Accept": "text/html,application/vnd.pypi.simple.v1+html;q=0.9,*/*;q=0.8",
            },
        ) as client:
            r = await client.get(url)
            r.raise_for_status()

        # Very cheap parse: extract href="/simple/<name>/" anchors.
        # PEP 503: normalized project names in anchor text, but we take anchor text.
        names: list[str] = []
        for line in r.text.splitlines():
            if "<a " not in line:
                continue
            # Fast path: anchor text is between > and </a>
            gt = line.find(">")
            end = line.rfind("</a>")
            if gt != -1 and end != -1 and end > gt:
                name = line[gt + 1 : end].strip()
                if name:
                    names.append(name)

        self._settings.cache_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._settings.cache_path.with_suffix(self._settings.cache_path.suffix + ".part")
        tmp.write_text("\n".join(sorted(set(names))), encoding="utf-8")
        tmp.replace(self._settings.cache_path)

    def iter_names(self) -> Iterable[str]:
        p = self._settings.cache_path
        if not p.exists():
            return []
        return (line.strip() for line in p.read_text(encoding="utf-8").splitlines() if line.strip())

    async def search_prefix(self, prefix: str, limit: int = 50) -> list[str]:
        await self.ensure_updated()
        pref = prefix.strip().lower()
        if not pref:
            return []
        out: list[str] = []
        for name in self.iter_names():
            if name.lower().startswith(pref):
                out.append(name)
                if len(out) >= max(1, int(limit)):
                    break
        return out

