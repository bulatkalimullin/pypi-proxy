from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Optional

import httpx


class PyPIError(RuntimeError):
    pass


@dataclass(frozen=True)
class SearchResult:
    name: str
    version: Optional[str]
    description: Optional[str]


class PyPIClient:
    def __init__(self, base_url: str = "https://pypi.org") -> None:
        self._base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=httpx.Timeout(30.0, connect=10.0),
            follow_redirects=True,
            limits=httpx.Limits(
                max_connections=40,
                max_keepalive_connections=20,
                keepalive_expiry=30,
            ),
            http2=True,
            headers={
                # PyPI search HTML may be served differently for non-browser UAs.
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def search(self, query: str, page: int = 1) -> list[SearchResult]:
        if not query.strip():
            return []

        # PyPI disabled XML-RPC search and the HTML search is JS-rendered (often blocked).
        # We implement "search" as an exact-name lookup via the JSON API.
        q = query.strip()
        try:
            pkg = await self.get_package_json(q)
        except PyPIError:
            return []

        info = pkg.get("info") or {}
        return [
            SearchResult(
                name=info.get("name") or q,
                version=info.get("version") or None,
                description=info.get("summary") or None,
            )
        ]

    # Note: _search_html kept out intentionally; PyPI search is JS-rendered.

    async def get_package_json(self, name: str) -> dict[str, Any]:
        resp = await self._client.get(f"/pypi/{name}/json")
        if resp.status_code == 404:
            raise PyPIError("Package not found")
        if resp.status_code != 200:
            raise PyPIError(f"PyPI package json failed: {resp.status_code}")
        return resp.json()

    async def get_version_json(self, name: str, version: str) -> dict[str, Any]:
        resp = await self._client.get(f"/pypi/{name}/{version}/json")
        if resp.status_code == 404:
            raise PyPIError("Version not found")
        if resp.status_code != 200:
            raise PyPIError(f"PyPI version json failed: {resp.status_code}")
        return resp.json()

    async def download_file(self, url: str, dest_path: str) -> None:
        async with self._client.stream("GET", url) as r:
            if r.status_code != 200:
                raise PyPIError(f"Download failed: {r.status_code}")
            import os

            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            tmp_path = dest_path + ".part"
            with open(tmp_path, "wb") as f:
                async for chunk in r.aiter_bytes():
                    if chunk:
                        f.write(chunk)
            os.replace(tmp_path, dest_path)


class SharedPyPIClient:
    """
    Small helper to share a single AsyncClient across requests.
    """

    def __init__(self, base_url: str) -> None:
        self._base_url = base_url
        self._lock = asyncio.Lock()
        self._client: Optional[PyPIClient] = None

    async def get(self) -> PyPIClient:
        if self._client is not None:
            return self._client
        async with self._lock:
            if self._client is None:
                self._client = PyPIClient(base_url=self._base_url)
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
