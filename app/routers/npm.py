from __future__ import annotations

import json

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse, Response

from app.services.cache import FileCache, MetadataCache
from app.services.npm_client import NpmError, SharedNpmClient
from app.services.stats import DownloadStats


router = APIRouter(tags=["npm"])


# ── npm registry protocol ──────────────────────────────────────────────────────
# Handles both regular packages (express) and scoped packages (@babel/core).
# npm tarball URLs always contain "/-/" as a separator, e.g.:
#   /npm/express/-/express-4.18.2.tgz
#   /npm/@babel/core/-/core-7.23.0.tgz

@router.get("/npm/{fullpath:path}")
async def npm_registry_handler(request: Request, fullpath: str) -> Response:
    """
    Unified npm registry handler.
    - If path contains '/-/', it's a tarball download.
    - Otherwise, it's a package metadata request.
    """
    # Check if it's a tarball download
    sep = "/-/"
    if sep in fullpath:
        sep_idx = fullpath.index(sep)
        pkg_name = fullpath[:sep_idx]
        filename = fullpath[sep_idx + len(sep):]
        return await _serve_tarball(request, pkg_name, filename)
    else:
        return await _serve_metadata(request, fullpath)


async def _serve_tarball(request: Request, name: str, filename: str) -> Response:
    npm_cache: FileCache = request.app.state.npm_cache
    npm: SharedNpmClient = request.app.state.npm_client
    stats: DownloadStats = request.app.state.download_stats

    # Use a sanitized cache key for scoped packages: @babel/core → @babel__core
    cache_key = name.replace("/", "__")
    dest = npm_cache.path_for(cache_key, "files", filename)
    if dest.is_file():
        stats.record(f"npm:{name}")
        return FileResponse(path=str(dest), filename=filename)

    client = await npm.get()
    # Reconstruct original URL
    original_url = f"{client._registry}/{name}/-/{filename}"
    npm_cache.ensure_parent(dest)
    await client.download_file(original_url, str(dest))
    stats.record(f"npm:{name}")
    return FileResponse(path=str(dest), filename=filename)


async def _serve_metadata(request: Request, name: str) -> Response:
    meta_cache: MetadataCache = request.app.state.meta_cache
    npm: SharedNpmClient = request.app.state.npm_client

    key = f"npm:{name}"
    data = meta_cache.get(key)
    if data is None:
        client = await npm.get()
        data = await client.get_package(name)
        meta_cache.set(key, data)

    return Response(content=json.dumps(data), media_type="application/json")


# ── JSON API for frontend UI ───────────────────────────────────────────────────

@router.get("/api/npm/search")
async def api_npm_search(request: Request, q: str = "", page: int = 1, limit: int = 20):
    if not q.strip():
        return {"q": q, "page": page, "results": [], "hasMore": False}
    npm: SharedNpmClient = request.app.state.npm_client
    client = await npm.get()
    size = min(limit * page, 100)
    results = await client.search(query=q, size=size)
    start = (page - 1) * limit
    chunk = results[start:start + limit]
    has_more = len(results) > start + limit
    return {
        "q": q,
        "page": page,
        "results": chunk,
        "hasMore": has_more,
        "nextPage": page + 1 if has_more else None,
    }


@router.get("/api/npm/package/{name:path}")
async def api_npm_package(request: Request, name: str):
    """Return npm package info for the UI."""
    meta_cache: MetadataCache = request.app.state.meta_cache
    npm: SharedNpmClient = request.app.state.npm_client

    key = f"npm:{name}"
    data = meta_cache.get(key)
    if data is None:
        client = await npm.get()
        data = await client.get_package(name)
        meta_cache.set(key, data)

    dist_tags = data.get("dist-tags") or {}
    latest_ver = dist_tags.get("latest", "")
    versions_dict = data.get("versions") or {}
    latest_info = versions_dict.get(latest_ver) or {}
    versions = list(reversed(list(versions_dict.keys())))

    return {
        "name": data.get("name", name),
        "version": latest_ver,
        "description": data.get("description") or latest_info.get("description", ""),
        "license": latest_info.get("license", ""),
        "homepage": latest_info.get("homepage") or data.get("homepage", ""),
        "repository": latest_info.get("repository") or {},
        "keywords": data.get("keywords") or latest_info.get("keywords") or [],
        "dependencies": latest_info.get("dependencies") or {},
        "devDependencies": latest_info.get("devDependencies") or {},
        "peerDependencies": latest_info.get("peerDependencies") or {},
        "versions": versions,
        "readme": data.get("readme", ""),
        "dist_tags": dist_tags,
    }


@router.get("/api/npm/cached")
async def api_npm_cached(request: Request):
    npm_cache: FileCache = request.app.state.npm_cache
    return {"packages": npm_cache.list_packages()}
