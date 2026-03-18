from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request

from app.services.cache import MetadataCache
from app.services.pypi_client import SharedPyPIClient
from app.services.simple_index import SimpleIndex


router = APIRouter(prefix="/api", tags=["api"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/search")
async def search(request: Request, q: str, page: int = 1, limit: int = 50):
    # Implement prefix-search via /simple/ mirror.
    idx: SimpleIndex = request.app.state.simple_index
    page = max(1, int(page))
    limit = min(200, max(1, int(limit)))

    # SimpleIndex doesn't support true paging; we load up to page*limit and slice.
    # This keeps memory usage reasonable while enabling infinite scroll UX.
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
async def refresh_simple_index(request: Request) -> dict[str, str]:
    idx: SimpleIndex = request.app.state.simple_index
    await idx.refresh()
    return {"status": "refreshed"}

@router.get("/cached")
async def cached(request: Request) -> dict[str, list[str]]:
    cache_dir: Path = request.app.state.settings.cache_dir
    if not cache_dir.exists():
        return {"packages": []}
    packages = sorted([p.name for p in cache_dir.iterdir() if p.is_dir()])
    return {"packages": packages}


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

