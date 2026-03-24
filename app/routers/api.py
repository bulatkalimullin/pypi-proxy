from __future__ import annotations

import secrets
import time
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from app.services.cache import FileCache, MetadataCache
from app.services.pypi_client import SharedPyPIClient
from app.services.simple_index import SimpleIndex
from app.services.stats import DownloadStats


router = APIRouter(prefix="/api", tags=["api"])
_security = HTTPBasic(auto_error=False)


def _require_admin(request: Request, credentials: HTTPBasicCredentials | None = Depends(_security)) -> None:
    """Verify admin password if ADMIN_PASSWORD is set."""
    password = request.app.state.settings.admin_password
    if not password:
        return  # No password configured — open access
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Basic"},
        )
    is_valid = secrets.compare_digest(credentials.password.encode(), password.encode())
    if not is_valid:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )


@router.get("/health")
async def health(request: Request) -> dict:
    file_cache: FileCache = request.app.state.file_cache
    started_at: float = request.app.state.download_stats.started_at()
    uptime_seconds = int(time.time() - started_at)
    total_bytes, file_count = file_cache.disk_usage()
    return {
        "status": "ok",
        "uptime_seconds": uptime_seconds,
        "cache_files": file_count,
        "cache_size_bytes": total_bytes,
    }


@router.get("/search")
async def search(request: Request, q: str, page: int = 1, limit: int = 50):
    idx: SimpleIndex = request.app.state.simple_index
    page = max(1, int(page))
    limit = min(200, max(1, int(limit)))

    names = await idx.search_prefix(prefix=q, limit=page * limit)
    start = (page - 1) * limit
    end = start + limit
    chunk = names[start:end]

    has_more = len(names) > end
    next_page = page + 1 if has_more else None
    return {
        "q": q,
        "page": page,
        "results": [{"name": n} for n in chunk],
        "hasMore": has_more,
        "nextPage": next_page,
    }


@router.post("/simple/refresh")
async def refresh_simple_index(request: Request, _: None = Depends(_require_admin)) -> dict[str, str]:
    idx: SimpleIndex = request.app.state.simple_index
    await idx.refresh()
    return {"status": "refreshed"}


@router.get("/cached")
async def cached(request: Request) -> dict[str, list[str]]:
    file_cache: FileCache = request.app.state.file_cache
    return {"packages": file_cache.list_packages()}


@router.get("/stats")
async def stats(request: Request) -> dict:
    file_cache: FileCache = request.app.state.file_cache
    dl_stats: DownloadStats = request.app.state.download_stats
    total_bytes, file_count = file_cache.disk_usage()
    packages = file_cache.list_packages()
    counts = dl_stats.all_counts()
    top_downloads = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:10]
    return {
        "cached_packages": len(packages),
        "cached_files": file_count,
        "cache_size_bytes": total_bytes,
        "download_counts": counts,
        "top_downloads": [{"name": n, "count": c} for n, c in top_downloads],
        "uptime_seconds": int(time.time() - dl_stats.started_at()),
    }


@router.delete("/cache")
async def clear_all_cache(
    request: Request, _: None = Depends(_require_admin)
) -> dict[str, str]:
    """Clear all cached package files."""
    import shutil
    file_cache: FileCache = request.app.state.file_cache
    for pkg_dir in file_cache.root_dir.iterdir():
        if pkg_dir.is_dir() and not pkg_dir.name.endswith(".txt"):
            shutil.rmtree(pkg_dir, ignore_errors=True)
    meta_cache: MetadataCache = request.app.state.meta_cache
    meta_cache._store.clear()
    return {"status": "cleared"}


@router.delete("/cache/{name}")
async def clear_package_cache(
    name: str, request: Request, _: None = Depends(_require_admin)
) -> dict[str, str]:
    """Clear cached files for a single package."""
    file_cache: FileCache = request.app.state.file_cache
    meta_cache: MetadataCache = request.app.state.meta_cache
    existed = file_cache.delete_package(name)
    meta_cache._store.pop(f"pkg:{name}", None)
    for key in list(meta_cache._store.keys()):
        if key.startswith(f"ver:{name}:"):
            meta_cache._store.pop(key, None)
    return {"status": "deleted" if existed else "not_found", "name": name}


@router.delete("/npm/cache")
async def clear_npm_cache(
    request: Request, _: None = Depends(_require_admin)
) -> dict[str, str]:
    """Clear all cached npm package files."""
    import shutil
    npm_cache: FileCache = request.app.state.npm_cache
    for pkg_dir in npm_cache.root_dir.iterdir():
        if pkg_dir.is_dir():
            shutil.rmtree(pkg_dir, ignore_errors=True)
    meta_cache: MetadataCache = request.app.state.meta_cache
    for key in list(meta_cache._store.keys()):
        if key.startswith("npm:"):
            meta_cache._store.pop(key, None)
    return {"status": "cleared"}


@router.delete("/npm/cache/{name:path}")
async def clear_npm_package_cache(
    name: str, request: Request, _: None = Depends(_require_admin)
) -> dict[str, str]:
    """Clear cached files for a single npm package."""
    npm_cache: FileCache = request.app.state.npm_cache
    meta_cache: MetadataCache = request.app.state.meta_cache
    existed = npm_cache.delete_package(name)
    meta_cache._store.pop(f"npm:{name}", None)
    return {"status": "deleted" if existed else "not_found", "name": name}


@router.delete("/nuget/cache")
async def clear_nuget_cache(
    request: Request, _: None = Depends(_require_admin)
) -> dict[str, str]:
    """Clear all cached NuGet package files."""
    import shutil
    nuget_cache: FileCache = request.app.state.nuget_cache
    for pkg_dir in nuget_cache.root_dir.iterdir():
        if pkg_dir.is_dir():
            shutil.rmtree(pkg_dir, ignore_errors=True)
    meta_cache: MetadataCache = request.app.state.meta_cache
    for key in list(meta_cache._store.keys()):
        if key.startswith("nuget:"):
            meta_cache._store.pop(key, None)
    return {"status": "cleared"}


@router.delete("/nuget/cache/{name}")
async def clear_nuget_package_cache(
    name: str, request: Request, _: None = Depends(_require_admin)
) -> dict[str, str]:
    """Clear cached files for a single NuGet package."""
    nuget_cache: FileCache = request.app.state.nuget_cache
    meta_cache: MetadataCache = request.app.state.meta_cache
    existed = nuget_cache.delete_package(name)
    meta_cache._store.pop(f"nuget:{name}", None)
    return {"status": "deleted" if existed else "not_found", "name": name}


@router.delete("/extensions/cache")
async def clear_extensions_cache(
    request: Request, _: None = Depends(_require_admin)
) -> dict[str, str]:
    """Clear all cached VS Code extension files."""
    import shutil

    ext_cache: FileCache = request.app.state.extensions_cache
    dl_stats: DownloadStats = request.app.state.download_stats
    for pkg_dir in ext_cache.root_dir.iterdir():
        if pkg_dir.is_dir():
            shutil.rmtree(pkg_dir, ignore_errors=True)
            stats_key = pkg_dir.name.replace("__", ".", 1)
            dl_stats.reset(f"extensions:{stats_key}")
    meta_cache: MetadataCache = request.app.state.meta_cache
    for key in list(meta_cache._store.keys()):
        if key.startswith("ext_"):
            meta_cache._store.pop(key, None)
    return {"status": "cleared"}


@router.delete("/extensions/cache/{publisher}/{name}")
async def clear_extension_cache(
    publisher: str, name: str, request: Request, _: None = Depends(_require_admin)
) -> dict[str, str]:
    ext_cache: FileCache = request.app.state.extensions_cache
    meta_cache: MetadataCache = request.app.state.meta_cache
    dl_stats: DownloadStats = request.app.state.download_stats
    cache_key = f"{publisher}__{name}"
    existed = ext_cache.delete_package(cache_key)
    dl_stats.reset(f"extensions:{publisher}.{name}")
    meta_cache._store.pop(f"ext_detail:{publisher}.{name}", None)
    for key in list(meta_cache._store.keys()):
        if key.startswith("ext_search:"):
            meta_cache._store.pop(key, None)
    return {"status": "deleted" if existed else "not_found", "name": f"{publisher}.{name}"}


@router.get("/package/{name}")
async def package(request: Request, name: str):
    pypi: SharedPyPIClient = request.app.state.pypi
    cache: MetadataCache = request.app.state.meta_cache
    key = f"pkg:{name}"
    data = cache.get(key)
    if data is None:
        client = await pypi.get()
        data = await client.get_package_json(name)
        cache.set(key, data)
    return data


@router.get("/package/{name}/{version}")
async def version(request: Request, name: str, version: str):
    pypi: SharedPyPIClient = request.app.state.pypi
    cache: MetadataCache = request.app.state.meta_cache
    key = f"ver:{name}:{version}"
    data = cache.get(key)
    if data is None:
        client = await pypi.get()
        data = await client.get_version_json(name, version)
        cache.set(key, data)
    return data
