from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from typing import Any, Optional

import httpx


class NpmError(RuntimeError):
    pass


class NpmClient:
    def __init__(self, registry_url: str, public_base_url: str) -> None:
        self._registry = registry_url.rstrip("/")
        self._public_base = public_base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._registry,
            timeout=httpx.Timeout(30.0, connect=10.0),
            follow_redirects=True,
            limits=httpx.Limits(
                max_connections=40,
                max_keepalive_connections=20,
                keepalive_expiry=30,
            ),
            http2=True,
            headers={
                "User-Agent": "pypi-proxy-npm/0.1",
                "Accept": "application/json",
            },
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    def _rewrite_tarball(self, url: str) -> str:
        """Rewrite tarball URL to point to our proxy download endpoint."""
        if not url:
            return url
        # e.g. https://registry.npmjs.org/express/-/express-4.18.2.tgz
        # → {public_base}/npm/express/-/express-4.18.2.tgz
        for prefix in [self._registry, "https://registry.npmjs.org"]:
            if url.startswith(prefix):
                path = url[len(prefix):]
                return f"{self._public_base}/npm{path}"
        return url

    def _rewrite_package(self, data: dict[str, Any]) -> dict[str, Any]:
        """Rewrite all dist.tarball URLs in package metadata."""
        for ver_data in (data.get("versions") or {}).values():
            dist = ver_data.get("dist")
            if dist and dist.get("tarball"):
                dist["tarball"] = self._rewrite_tarball(dist["tarball"])
        return data

    async def get_package(self, name: str) -> dict[str, Any]:
        """Fetch full package metadata from npm registry."""
        encoded = name.replace("/", "%2F")
        resp = await self._client.get(f"/{encoded}")
        if resp.status_code == 404:
            raise NpmError(f"Package not found: {name}")
        if resp.status_code != 200:
            raise NpmError(f"npm registry error: {resp.status_code}")
        data = resp.json()
        return self._rewrite_package(data)

    async def search(self, query: str, size: int = 20) -> list[dict[str, Any]]:
        """Search npm registry."""
        if not query.strip():
            return []
        resp = await self._client.get(
            "/-/v1/search",
            params={"text": query.strip(), "size": min(size, 50)},
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        results = []
        for obj in data.get("objects") or []:
            pkg = obj.get("package") or {}
            results.append({
                "name": pkg.get("name", ""),
                "version": pkg.get("version", ""),
                "description": pkg.get("description", ""),
                "keywords": pkg.get("keywords") or [],
            })
        return results

    async def download_file(self, url: str, dest_path: str) -> None:
        """Download a tarball from the original registry URL."""
        # url may be already rewritten — recover original
        original_url = url
        for prefix in [f"{self._public_base}/npm"]:
            if original_url.startswith(prefix):
                original_url = self._registry + original_url[len(prefix):]
                break

        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0), follow_redirects=True) as client:
            async with client.stream("GET", original_url) as r:
                if r.status_code != 200:
                    raise NpmError(f"Download failed: {r.status_code}")
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                tmp = dest_path + ".part"
                with open(tmp, "wb") as f:
                    async for chunk in r.aiter_bytes():
                        if chunk:
                            f.write(chunk)
                os.replace(tmp, dest_path)


class SharedNpmClient:
    def __init__(self, registry_url: str, public_base_url: str) -> None:
        self._registry_url = registry_url
        self._public_base_url = public_base_url
        self._lock = asyncio.Lock()
        self._client: Optional[NpmClient] = None

    async def get(self) -> NpmClient:
        if self._client is not None:
            return self._client
        async with self._lock:
            if self._client is None:
                self._client = NpmClient(
                    registry_url=self._registry_url,
                    public_base_url=self._public_base_url,
                )
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
