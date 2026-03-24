from __future__ import annotations

import asyncio
import ipaddress
import socket
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

import httpx


class JsProxyError(RuntimeError):
    pass


@dataclass
class JsHealthResult:
    ok: bool
    status_code: int | None
    content_type: str | None
    checked_at: str
    message: str | None = None


class JsProxyStats:
    def __init__(self) -> None:
        self._url_hits: Counter[str] = Counter()
        self._domain_hits: Counter[str] = Counter()
        self._last_health: dict[str, dict[str, Any]] = {}

    def record_proxy_hit(self, url: str, domain: str) -> None:
        self._url_hits[url] += 1
        self._domain_hits[domain] += 1

    def record_health(self, url: str, result: JsHealthResult) -> None:
        self._last_health[url] = {
            "ok": result.ok,
            "status_code": result.status_code,
            "content_type": result.content_type,
            "checked_at": result.checked_at,
            "message": result.message,
        }

    def as_dict(self) -> dict[str, Any]:
        top_urls = self._url_hits.most_common(20)
        top_domains = self._domain_hits.most_common(20)
        return {
            "total_proxy_requests": sum(self._url_hits.values()),
            "unique_urls": len(self._url_hits),
            "unique_domains": len(self._domain_hits),
            "top_urls": [{"url": url, "count": count} for url, count in top_urls],
            "top_domains": [{"domain": domain, "count": count} for domain, count in top_domains],
            "last_health_checks": self._last_health,
        }


class JsProxyClient:
    def __init__(self) -> None:
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(25.0, connect=8.0),
            follow_redirects=True,
            headers={
                "User-Agent": "pypi-proxy-js/0.1",
                "Accept": "application/javascript, text/javascript, */*",
            },
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def validate_url(self, raw_url: str) -> str:
        url = (raw_url or "").strip()
        if not url:
            raise JsProxyError("URL is required")

        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            raise JsProxyError("Only http/https URLs are allowed")
        if not parsed.hostname:
            raise JsProxyError("URL hostname is missing")

        await self._guard_public_host(parsed.hostname)
        return url

    async def _guard_public_host(self, host: str) -> None:
        host_l = host.lower()
        if host_l in {"localhost"}:
            raise JsProxyError("Localhost targets are not allowed")

        try:
            infos = await asyncio.get_running_loop().getaddrinfo(
                host,
                None,
                family=socket.AF_UNSPEC,
                type=socket.SOCK_STREAM,
            )
        except socket.gaierror as exc:
            raise JsProxyError(f"Cannot resolve host: {host}") from exc

        has_public_ip = False
        for info in infos:
            ip_raw = info[4][0]
            ip_obj = ipaddress.ip_address(ip_raw)
            is_non_public = (
                ip_obj.is_private
                or ip_obj.is_loopback
                or ip_obj.is_link_local
                or ip_obj.is_reserved
                or ip_obj.is_multicast
                or ip_obj.is_unspecified
            )
            if not is_non_public:
                has_public_ip = True
                break

        if not has_public_ip:
            raise JsProxyError("Target host does not resolve to a public IP")

    async def health_check(self, url: str) -> JsHealthResult:
        checked_at = datetime.now(timezone.utc).isoformat()
        try:
            response = await self._client.head(url)
            if response.status_code == 405:
                response = await self._client.get(url, headers={"Range": "bytes=0-0"})
            content_type = response.headers.get("content-type")
            return JsHealthResult(
                ok=200 <= response.status_code < 400,
                status_code=response.status_code,
                content_type=content_type,
                checked_at=checked_at,
            )
        except httpx.HTTPError as exc:
            return JsHealthResult(
                ok=False,
                status_code=None,
                content_type=None,
                checked_at=checked_at,
                message=str(exc),
            )

    async def stream(self, url: str) -> httpx.Response:
        req = self._client.build_request("GET", url)
        response = await self._client.send(req, stream=True)
        if response.status_code >= 400:
            body = await response.aread()
            await response.aclose()
            detail = body.decode("utf-8", errors="ignore")[:300]
            raise JsProxyError(f"Upstream responded with {response.status_code}: {detail}")
        return response


class SharedJsProxyClient:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._client: JsProxyClient | None = None

    async def get(self) -> JsProxyClient:
        if self._client is not None:
            return self._client
        async with self._lock:
            if self._client is None:
                self._client = JsProxyClient()
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
