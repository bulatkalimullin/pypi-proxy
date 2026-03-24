from __future__ import annotations

from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Query, Request
from starlette.background import BackgroundTask
from fastapi.responses import JSONResponse, StreamingResponse
import httpx

from app.services.js_proxy_client import JsProxyError, JsProxyStats, SharedJsProxyClient


router = APIRouter(tags=["js-libraries"])


def _safe_headers(upstream_headers) -> dict[str, str]:
    allowed = {"content-type", "cache-control", "etag", "last-modified", "expires"}
    result: dict[str, str] = {}
    for key, value in upstream_headers.items():
        if key.lower() in allowed:
            result[key] = value
    return result


@router.get("/js-proxy")
async def js_proxy(
    request: Request,
    url: str = Query(..., description="External JS URL to proxy"),
):
    shared_client: SharedJsProxyClient = request.app.state.js_proxy_client
    js_stats: JsProxyStats = request.app.state.js_proxy_stats

    client = await shared_client.get()
    try:
        valid_url = await client.validate_url(url)
        upstream = await client.stream(valid_url)
    except JsProxyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Upstream request failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Proxy failed: {exc}") from exc

    domain = urlparse(valid_url).hostname or "unknown"
    js_stats.record_proxy_hit(valid_url, domain)

    headers = _safe_headers(upstream.headers)
    media_type = upstream.headers.get("content-type") or "application/javascript"
    return StreamingResponse(
        upstream.aiter_bytes(),
        media_type=media_type,
        headers=headers,
        background=BackgroundTask(upstream.aclose),
    )


@router.get("/api/js/health")
async def js_health(
    request: Request,
    url: str = Query(..., description="External JS URL to check"),
):
    shared_client: SharedJsProxyClient = request.app.state.js_proxy_client
    js_stats: JsProxyStats = request.app.state.js_proxy_stats
    client = await shared_client.get()

    try:
        valid_url = await client.validate_url(url)
    except JsProxyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    result = await client.health_check(valid_url)
    js_stats.record_health(valid_url, result)

    return {
        "url": valid_url,
        "ok": result.ok,
        "status_code": result.status_code,
        "content_type": result.content_type,
        "checked_at": result.checked_at,
        "message": result.message,
    }


@router.get("/api/js/stats")
async def js_stats(request: Request):
    stats: JsProxyStats = request.app.state.js_proxy_stats
    return JSONResponse(stats.as_dict())
