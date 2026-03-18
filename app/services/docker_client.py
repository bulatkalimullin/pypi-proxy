from __future__ import annotations

import asyncio
import os
import time
from dataclasses import dataclass
from typing import Any, Optional

import httpx


class DockerError(RuntimeError):
    pass


@dataclass
class _TokenEntry:
    token: str
    expires_at: float


class DockerRegistryClient:
    """
    Docker Registry HTTP API v2 pull-through proxy client.
    Handles Bearer token authentication against Docker Hub.
    """

    def __init__(self, registry_url: str, auth_url: str) -> None:
        self._registry = registry_url.rstrip("/")
        self._auth_url = auth_url
        self._token_cache: dict[str, _TokenEntry] = {}
        self._token_lock = asyncio.Lock()

        self._registry_client = httpx.AsyncClient(
            base_url=self._registry,
            timeout=httpx.Timeout(60.0),
            follow_redirects=True,
            headers={"User-Agent": "pkg-proxy-docker/0.1"},
        )
        self._hub_client = httpx.AsyncClient(
            base_url="https://hub.docker.com",
            timeout=httpx.Timeout(30.0),
            follow_redirects=True,
            headers={"User-Agent": "pkg-proxy-docker/0.1"},
        )

    async def aclose(self) -> None:
        await self._registry_client.aclose()
        await self._hub_client.aclose()

    async def _get_token(self, scope: str) -> str:
        """Fetch and cache a Bearer token for the given scope."""
        now = time.monotonic()
        entry = self._token_cache.get(scope)
        if entry and entry.expires_at > now:
            return entry.token

        async with self._token_lock:
            # Double-check after acquiring lock
            entry = self._token_cache.get(scope)
            if entry and entry.expires_at > now:
                return entry.token

            async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
                resp = await client.get(
                    self._auth_url,
                    params={"service": "registry.docker.io", "scope": scope},
                )
            if resp.status_code != 200:
                raise DockerError(f"Token fetch failed: {resp.status_code}")

            data = resp.json()
            token = data.get("token") or data.get("access_token", "")
            expires_in = int(data.get("expires_in", 300))
            self._token_cache[scope] = _TokenEntry(
                token=token,
                expires_at=time.monotonic() + expires_in - 30,
            )
            return token

    def _scope(self, name: str) -> str:
        return f"repository:{name}:pull"

    async def _auth_headers(self, name: str) -> dict[str, str]:
        token = await self._get_token(self._scope(name))
        return {"Authorization": f"Bearer {token}"}

    async def get_manifest(
        self,
        name: str,
        reference: str,
        accept: str = (
            "application/vnd.docker.distribution.manifest.v2+json,"
            "application/vnd.docker.distribution.manifest.list.v2+json,"
            "application/vnd.oci.image.manifest.v1+json,"
            "application/vnd.oci.image.index.v1+json,"
            "*/*"
        ),
    ) -> tuple[bytes, str, str]:
        """
        Fetch manifest for name:reference.
        Returns (content_bytes, content_type, digest).
        """
        headers = await self._auth_headers(name)
        headers["Accept"] = accept
        resp = await self._registry_client.get(
            f"/v2/{name}/manifests/{reference}", headers=headers
        )
        if resp.status_code == 404:
            raise DockerError(f"Manifest not found: {name}:{reference}")
        if resp.status_code not in (200, 304):
            raise DockerError(f"Manifest fetch failed: {resp.status_code}")
        content_type = resp.headers.get("Content-Type", "application/octet-stream")
        digest = resp.headers.get("Docker-Content-Digest", "")
        return resp.content, content_type, digest

    async def head_manifest(self, name: str, reference: str) -> dict[str, str]:
        """Returns headers dict from HEAD manifest request."""
        accept = (
            "application/vnd.docker.distribution.manifest.v2+json,"
            "application/vnd.docker.distribution.manifest.list.v2+json,"
            "application/vnd.oci.image.manifest.v1+json,"
            "*/*"
        )
        headers = await self._auth_headers(name)
        headers["Accept"] = accept
        resp = await self._registry_client.head(
            f"/v2/{name}/manifests/{reference}", headers=headers
        )
        if resp.status_code == 404:
            raise DockerError(f"Manifest not found: {name}:{reference}")
        return dict(resp.headers)

    async def get_blob_stream(self, name: str, digest: str) -> httpx.Response:
        """
        Start a streaming GET for a blob.
        Caller must close the response when done.
        Returns an open httpx.Response in streaming mode.
        """
        headers = await self._auth_headers(name)
        req = self._registry_client.build_request(
            "GET", f"/v2/{name}/blobs/{digest}", headers=headers
        )
        resp = await self._registry_client.send(req, stream=True)
        if resp.status_code == 404:
            raise DockerError(f"Blob not found: {digest}")
        if resp.status_code not in (200, 206):
            await resp.aclose()
            raise DockerError(f"Blob fetch failed: {resp.status_code}")
        return resp

    async def head_blob(self, name: str, digest: str) -> Optional[dict[str, str]]:
        """Check if blob exists upstream. Returns headers or None if 404."""
        headers = await self._auth_headers(name)
        resp = await self._registry_client.head(
            f"/v2/{name}/blobs/{digest}", headers=headers
        )
        if resp.status_code == 404:
            return None
        if resp.status_code != 200:
            return None
        return dict(resp.headers)

    async def get_tags(self, name: str) -> dict[str, Any]:
        """List all tags for an image."""
        headers = await self._auth_headers(name)
        resp = await self._registry_client.get(
            f"/v2/{name}/tags/list", headers=headers
        )
        if resp.status_code == 404:
            raise DockerError(f"Image not found: {name}")
        if resp.status_code != 200:
            raise DockerError(f"Tags fetch failed: {resp.status_code}")
        return resp.json()

    async def search_hub(
        self, query: str, page: int = 1, page_size: int = 25
    ) -> dict[str, Any]:
        """Search Docker Hub for images."""
        if not query.strip():
            return {"count": 0, "results": []}
        resp = await self._hub_client.get(
            "/v2/search/repositories/",
            params={"query": query.strip(), "page": page, "page_size": min(page_size, 50)},
        )
        if resp.status_code != 200:
            return {"count": 0, "results": []}
        return resp.json()

    async def get_hub_image_info(self, name: str) -> dict[str, Any]:
        """Get Docker Hub repository metadata."""
        # For official images, name is like "library/nginx" or just "nginx"
        path = name if "/" in name else f"library/{name}"
        resp = await self._hub_client.get(f"/v2/repositories/{path}/")
        if resp.status_code == 404:
            raise DockerError(f"Image not found on Hub: {name}")
        if resp.status_code != 200:
            raise DockerError(f"Hub info failed: {resp.status_code}")
        return resp.json()

    async def get_hub_tags(self, name: str, page_size: int = 20) -> dict[str, Any]:
        """Get tags from Docker Hub API."""
        path = name if "/" in name else f"library/{name}"
        resp = await self._hub_client.get(
            f"/v2/repositories/{path}/tags/",
            params={"page_size": page_size, "ordering": "last_updated"},
        )
        if resp.status_code != 200:
            return {"results": []}
        return resp.json()


class SharedDockerRegistryClient:
    """Singleton wrapper for DockerRegistryClient."""

    def __init__(self, registry_url: str, auth_url: str) -> None:
        self._registry_url = registry_url
        self._auth_url = auth_url
        self._lock = asyncio.Lock()
        self._client: Optional[DockerRegistryClient] = None

    async def get(self) -> DockerRegistryClient:
        if self._client is not None:
            return self._client
        async with self._lock:
            if self._client is None:
                self._client = DockerRegistryClient(
                    registry_url=self._registry_url,
                    auth_url=self._auth_url,
                )
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
