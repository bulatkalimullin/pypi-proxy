from __future__ import annotations

import asyncio
import os
from typing import Any, Optional

import httpx


class NuGetError(RuntimeError):
    pass


class NuGetClient:
    # NuGet v3 API endpoints
    _SEARCH_URL = "https://azuresearch-usnc.nuget.org/query"
    _REGISTRATION_BASE = "https://api.nuget.org/v3/registration5-semver1"
    _FLATCONTAINER_BASE = "https://api.nuget.org/v3-flatcontainer"

    def __init__(self, registry_url: str, public_base_url: str) -> None:
        self._registry = registry_url.rstrip("/")
        self._public_base = public_base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            follow_redirects=True,
            headers={
                "User-Agent": "pypi-proxy-nuget/0.1",
                "Accept": "application/json",
            },
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    def _rewrite_nupkg_url(self, url: str) -> str:
        """Rewrite .nupkg download URL to point to our proxy."""
        if not url:
            return url
        # e.g. https://api.nuget.org/v3-flatcontainer/newtonsoft.json/13.0.3/newtonsoft.json.13.0.3.nupkg
        # → {public_base}/nuget/v3/package/newtonsoft.json/13.0.3/newtonsoft.json.13.0.3.nupkg
        if self._FLATCONTAINER_BASE in url:
            path = url[len(self._FLATCONTAINER_BASE):]
            return f"{self._public_base}/nuget/v3/package{path}"
        return url

    async def search(self, query: str, skip: int = 0, take: int = 20) -> dict[str, Any]:
        """Search NuGet packages."""
        resp = await self._client.get(
            self._SEARCH_URL,
            params={"q": query.strip(), "skip": skip, "take": min(take, 50), "prerelease": "false"},
        )
        if resp.status_code != 200:
            return {"totalHits": 0, "data": []}
        return resp.json()

    async def get_registration(self, package_id: str) -> dict[str, Any]:
        """Fetch registration (metadata + versions) for a package."""
        pid = package_id.lower()
        url = f"{self._REGISTRATION_BASE}/{pid}/index.json"
        resp = await self._client.get(url)
        if resp.status_code == 404:
            raise NuGetError(f"Package not found: {package_id}")
        if resp.status_code != 200:
            raise NuGetError(f"NuGet registration error: {resp.status_code}")
        data = resp.json()
        # Rewrite download URLs in catalog entries
        for page in data.get("items") or []:
            for entry in page.get("items") or []:
                catalog = entry.get("catalogEntry") or {}
                if catalog.get("packageContent"):
                    catalog["packageContent"] = self._rewrite_nupkg_url(catalog["packageContent"])
        return data

    async def get_package_content_url(self, package_id: str, version: str, filename: str) -> str:
        """Return the original upstream download URL for a .nupkg file."""
        pid = package_id.lower()
        ver = version.lower()
        return f"{self._FLATCONTAINER_BASE}/{pid}/{ver}/{pid}.{ver}.nupkg"

    async def download_package(self, package_id: str, version: str, dest_path: str) -> None:
        """Download a .nupkg file from NuGet and save to dest_path."""
        url = await self.get_package_content_url(package_id, version, "")
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0), follow_redirects=True) as client:
            async with client.stream("GET", url) as r:
                if r.status_code != 200:
                    raise NuGetError(f"Download failed: {r.status_code}")
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                tmp = dest_path + ".part"
                with open(tmp, "wb") as f:
                    async for chunk in r.aiter_bytes():
                        if chunk:
                            f.write(chunk)
                os.replace(tmp, dest_path)


class SharedNuGetClient:
    def __init__(self, registry_url: str, public_base_url: str) -> None:
        self._registry_url = registry_url
        self._public_base_url = public_base_url
        self._lock = asyncio.Lock()
        self._client: Optional[NuGetClient] = None

    async def get(self) -> NuGetClient:
        if self._client is not None:
            return self._client
        async with self._lock:
            if self._client is None:
                self._client = NuGetClient(
                    registry_url=self._registry_url,
                    public_base_url=self._public_base_url,
                )
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
