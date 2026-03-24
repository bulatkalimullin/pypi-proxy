from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Optional

import httpx


class VsCodeExtensionsError(RuntimeError):
    pass


@dataclass
class ExtensionVersion:
    version: str
    last_updated: str
    download_url: str
    vsix_asset_path: str


class VsCodeExtensionsClient:
    def __init__(self) -> None:
        self._market_client = httpx.AsyncClient(
            base_url="https://marketplace.visualstudio.com",
            timeout=httpx.Timeout(30.0),
            follow_redirects=True,
            headers={"User-Agent": "pkg-proxy-vscode/0.1"},
        )
        self._openvsx_client = httpx.AsyncClient(
            base_url="https://open-vsx.org",
            timeout=httpx.Timeout(30.0),
            follow_redirects=True,
            headers={"User-Agent": "pkg-proxy-vscode/0.1"},
        )

    async def aclose(self) -> None:
        await self._market_client.aclose()
        await self._openvsx_client.aclose()

    async def search(
        self,
        query: str,
        page: int = 1,
        page_size: int = 20,
        *,
        min_rating: float = 0.0,
        verified_only: bool = False,
        category: str = "",
        sort_by: str = "relevance",
        source: str = "auto",
    ) -> dict[str, Any]:
        source_mode = source.lower()
        if source_mode == "openvsx":
            return await self._search_openvsx(
                query=query,
                page=page,
                page_size=page_size,
                min_rating=min_rating,
                verified_only=verified_only,
                category=category,
                sort_by=sort_by,
            )
        if source_mode == "marketplace":
            return await self._search_marketplace(
                query=query,
                page=page,
                page_size=page_size,
                min_rating=min_rating,
                verified_only=verified_only,
                category=category,
                sort_by=sort_by,
            )

        market = await self._search_marketplace(
            query=query,
            page=page,
            page_size=page_size,
            min_rating=min_rating,
            verified_only=verified_only,
            category=category,
            sort_by=sort_by,
        )
        if market["results"]:
            return market
        return await self._search_openvsx(
            query=query,
            page=page,
            page_size=page_size,
            min_rating=min_rating,
            verified_only=verified_only,
            category=category,
            sort_by=sort_by,
        )

    async def get_extension(self, publisher: str, name: str, *, source: str = "auto") -> dict[str, Any]:
        source_mode = source.lower()
        if source_mode == "openvsx":
            ext = await self._get_openvsx_extension(publisher, name)
            if ext is None:
                raise VsCodeExtensionsError(f"Extension not found on Open VSX: {publisher}.{name}")
            return ext
        if source_mode == "marketplace":
            ext = await self._get_marketplace_extension(publisher, name)
            if ext is None:
                raise VsCodeExtensionsError(f"Extension not found on Marketplace: {publisher}.{name}")
            return ext

        ext = await self._get_openvsx_extension(publisher, name)
        if ext is not None:
            return ext
        fallback = await self._get_marketplace_extension(publisher, name)
        if fallback is None:
            raise VsCodeExtensionsError(f"Extension not found: {publisher}.{name}")
        return fallback

    async def get_versions(self, publisher: str, name: str, *, source: str = "auto") -> list[dict[str, str]]:
        ext = await self.get_extension(publisher, name, source=source)
        versions = ext.get("versions") or []
        return versions

    async def get_latest_download(self, publisher: str, name: str, *, source: str = "auto") -> str:
        versions = await self.get_versions(publisher, name, source=source)
        if not versions:
            raise VsCodeExtensionsError(f"No versions available for {publisher}.{name}")
        download_url = versions[0].get("downloadUrl", "")
        if not download_url:
            raise VsCodeExtensionsError(f"No download URL available for {publisher}.{name}")
        return download_url

    async def open_download_stream(self, url: str) -> httpx.Response:
        req = self._market_client.build_request("GET", url)
        resp = await self._market_client.send(req, stream=True)
        if resp.status_code != 200:
            await resp.aclose()
            req = self._openvsx_client.build_request("GET", url)
            resp = await self._openvsx_client.send(req, stream=True)
            if resp.status_code != 200:
                await resp.aclose()
                raise VsCodeExtensionsError(f"VSIX download failed: {url}")
        return resp

    async def _search_marketplace(
        self,
        query: str,
        page: int,
        page_size: int,
        *,
        min_rating: float,
        verified_only: bool,
        category: str,
        sort_by: str,
    ) -> dict[str, Any]:
        # Flags chosen to include stats, versions and asset uris.
        payload = {
            "filters": [
                {
                    "criteria": [{"filterType": 10, "value": query.strip()}],
                    "pageNumber": max(1, page),
                    "pageSize": min(max(page_size, 1), 50),
                    "sortBy": 0 if sort_by == "relevance" else 4,
                    "sortOrder": 0,
                }
            ],
            "assetTypes": [],
            "flags": 914,
        }
        headers = {
            "Accept": "application/json;api-version=7.2-preview.1;excludeUrls=true",
            "Content-Type": "application/json",
        }
        try:
            res = await self._market_client.post(
                "/_apis/public/gallery/extensionquery",
                params={"api-version": "7.2-preview.1"},
                headers=headers,
                json=payload,
            )
        except Exception:
            return {"q": query, "page": page, "results": [], "count": 0, "hasMore": False}
        if res.status_code != 200:
            return {"q": query, "page": page, "results": [], "count": 0, "hasMore": False}
        data = res.json()
        batches = data.get("results") or []
        if not batches:
            return {"q": query, "page": page, "results": [], "count": 0, "hasMore": False}
        items = batches[0].get("extensions") or []
        normalized: list[dict[str, Any]] = []
        for item in items:
            mapped = self._normalize_marketplace_extension(item)
            if mapped is None:
                continue
            if mapped.get("rating", 0.0) < min_rating:
                continue
            if verified_only and not mapped.get("verified", False):
                continue
            if category and category.lower() not in [c.lower() for c in mapped.get("categories", [])]:
                continue
            normalized.append(mapped)
        total = batches[0].get("resultMetadata", [{}])[0].get("metadataItems", [{}])[0].get("count", len(normalized))
        has_more = page * page_size < total
        return {
            "q": query,
            "page": page,
            "count": total,
            "results": normalized,
            "hasMore": has_more,
            "nextPage": page + 1 if has_more else None,
        }

    async def _search_openvsx(
        self,
        query: str,
        page: int,
        page_size: int,
        *,
        min_rating: float,
        verified_only: bool,
        category: str,
        sort_by: str,
    ) -> dict[str, Any]:
        try:
            res = await self._openvsx_client.get(
                "/api/-/search",
                params={
                    "query": query.strip(),
                    "offset": max(page - 1, 0) * page_size,
                    "size": min(max(page_size, 1), 50),
                    "sortBy": "relevance" if sort_by == "relevance" else "downloadCount",
                },
            )
        except Exception:
            return {"q": query, "page": page, "results": [], "count": 0, "hasMore": False}
        if res.status_code != 200:
            return {"q": query, "page": page, "results": [], "count": 0, "hasMore": False}
        data = res.json()
        items = data.get("extensions") or []
        normalized: list[dict[str, Any]] = []
        for item in items:
            mapped = self._normalize_openvsx_search(item)
            if mapped.get("rating", 0.0) < min_rating:
                continue
            if verified_only and not mapped.get("verified", False):
                continue
            if category and category.lower() not in [c.lower() for c in mapped.get("categories", [])]:
                continue
            normalized.append(mapped)
        total = int(data.get("totalSize", len(normalized)))
        has_more = page * page_size < total
        return {
            "q": query,
            "page": page,
            "count": total,
            "results": normalized,
            "hasMore": has_more,
            "nextPage": page + 1 if has_more else None,
        }

    async def _get_marketplace_extension(self, publisher: str, name: str) -> Optional[dict[str, Any]]:
        query = f"{publisher}.{name}"
        data = await self._search_marketplace(query=query, page=1, page_size=1, min_rating=0, verified_only=False, category="", sort_by="relevance")
        if not data["results"]:
            return None
        ext = data["results"][0]
        if ext.get("publisher", "").lower() != publisher.lower() or ext.get("name", "").lower() != name.lower():
            return None
        return ext

    async def _get_openvsx_extension(self, publisher: str, name: str) -> Optional[dict[str, Any]]:
        try:
            res = await self._openvsx_client.get(f"/api/{publisher}/{name}")
        except Exception:
            return None
        if res.status_code != 200:
            return None
        return self._normalize_openvsx_detail(res.json())

    def _normalize_marketplace_extension(self, item: dict[str, Any]) -> Optional[dict[str, Any]]:
        publisher = ((item.get("publisher") or {}).get("publisherName") or "").strip()
        ext_name = (item.get("extensionName") or "").strip()
        display_name = (item.get("displayName") or ext_name).strip()
        if not publisher or not ext_name:
            return None
        stats = {s.get("statisticName"): s.get("value", 0) for s in (item.get("statistics") or [])}
        versions: list[dict[str, str]] = []
        for ver in (item.get("versions") or []):
            files = ver.get("files") or []
            download_url = ""
            icon_url = ""
            for f in files:
                asset_type = f.get("assetType", "")
                if asset_type.endswith("Microsoft.VisualStudio.Services.VSIXPackage"):
                    download_url = f.get("source", "")
                if asset_type.endswith("Microsoft.VisualStudio.Services.Icons.Default"):
                    icon_url = f.get("source", "")
            if not download_url:
                continue
            v = ver.get("version", "")
            versions.append(
                {
                    "version": v,
                    "lastUpdated": ver.get("lastUpdated", ""),
                    "downloadUrl": download_url,
                    "vsixAssetPath": f"/extensions/vsix/{publisher}/{ext_name}/{v}.vsix",
                }
            )
            if not icon_url:
                icon_url = ver.get("assetUri", "")
        categories = item.get("categories") or []
        tags = item.get("tags") or []
        verified = bool(((item.get("publisher") or {}).get("flags", "none") != "none"))
        return {
            "id": f"{publisher}.{ext_name}",
            "publisher": publisher,
            "name": ext_name,
            "displayName": display_name,
            "description": item.get("shortDescription", "") or item.get("displayName", ""),
            "logoUrl": icon_url,
            "rating": float(stats.get("averagerating", 0) or 0),
            "ratingCount": int(stats.get("ratingcount", 0) or 0),
            "installs": int(stats.get("install", 0) or 0),
            "verified": verified,
            "categories": categories,
            "tags": tags,
            "source": "marketplace",
            "versions": versions,
        }

    def _normalize_openvsx_search(self, item: dict[str, Any]) -> dict[str, Any]:
        namespace = item.get("namespace", "")
        name = item.get("name", "")
        version = item.get("version", "")
        return {
            "id": f"{namespace}.{name}",
            "publisher": namespace,
            "name": name,
            "displayName": item.get("displayName") or name,
            "description": item.get("description", ""),
            "logoUrl": item.get("files", {}).get("icon", ""),
            "rating": float(item.get("averageRating", 0) or 0),
            "ratingCount": int(item.get("reviewCount", 0) or 0),
            "installs": int(item.get("downloadCount", 0) or 0),
            "verified": bool(item.get("verified", False)),
            "categories": item.get("categories") or [],
            "tags": item.get("tags") or [],
            "source": "openvsx",
            "versions": [
                {
                    "version": version,
                    "lastUpdated": item.get("timestamp", ""),
                    "downloadUrl": item.get("files", {}).get("download", ""),
                    "vsixAssetPath": f"/extensions/vsix/{namespace}/{name}/{version}.vsix",
                }
            ],
        }

    def _normalize_openvsx_detail(self, item: dict[str, Any]) -> dict[str, Any]:
        base = self._normalize_openvsx_search(item)
        files = item.get("files") or {}
        version = item.get("version", "")
        base["versions"] = [
            {
                "version": version,
                "lastUpdated": item.get("timestamp", ""),
                "downloadUrl": files.get("download", ""),
                "vsixAssetPath": f"/extensions/vsix/{base['publisher']}/{base['name']}/{version}.vsix",
            }
        ]
        return base


class SharedVsCodeExtensionsClient:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._client: Optional[VsCodeExtensionsClient] = None

    async def get(self) -> VsCodeExtensionsClient:
        if self._client is not None:
            return self._client
        async with self._lock:
            if self._client is None:
                self._client = VsCodeExtensionsClient()
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
