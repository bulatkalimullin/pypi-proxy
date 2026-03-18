from __future__ import annotations

import json

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse, Response

from app.services.cache import FileCache, MetadataCache
from app.services.nuget_client import NuGetError, SharedNuGetClient
from app.services.stats import DownloadStats


router = APIRouter(tags=["nuget"])


# ── NuGet v3 protocol ─────────────────────────────────────────────────────────

@router.get("/nuget/v3/index.json")
async def nuget_service_index(request: Request):
    """NuGet v3 Service Index — tells clients where our endpoints are."""
    settings = request.app.state.settings
    base = (settings.public_base_url or str(request.base_url).rstrip("/"))
    return {
        "version": "3.0.0",
        "resources": [
            {
                "@id": f"{base}/nuget/v3/query",
                "@type": "SearchQueryService",
                "comment": "Query endpoint for NuGet packages",
            },
            {
                "@id": f"{base}/nuget/v3/query",
                "@type": "SearchQueryService/3.5.0",
                "comment": "Query endpoint for NuGet packages",
            },
            {
                "@id": f"{base}/nuget/v3/registration/",
                "@type": "RegistrationsBaseUrl",
                "comment": "Base URL for NuGet package registration",
            },
            {
                "@id": f"{base}/nuget/v3/registration/",
                "@type": "RegistrationsBaseUrl/3.0.0-rc",
                "comment": "Base URL for NuGet package registration",
            },
            {
                "@id": f"{base}/nuget/v3/package/",
                "@type": "PackageBaseAddress/3.0.0",
                "comment": "Base URL for NuGet package content",
            },
        ],
    }


@router.get("/nuget/v3/query")
async def nuget_search(
    request: Request,
    q: str = "",
    skip: int = 0,
    take: int = 20,
    prerelease: bool = False,
):
    """NuGet SearchQueryService endpoint — proxy from NuGet."""
    nuget: SharedNuGetClient = request.app.state.nuget_client
    client = await nuget.get()
    try:
        result = await client.search(query=q, skip=skip, take=min(take, 50))
        return result
    except Exception as e:
        return {"totalHits": 0, "data": [], "error": str(e)}


@router.get("/nuget/v3/registration/{id}/index.json")
async def nuget_registration(request: Request, id: str):
    """NuGet RegistrationsBaseUrl endpoint — proxy from NuGet with URL rewriting."""
    meta_cache: MetadataCache = request.app.state.meta_cache
    nuget: SharedNuGetClient = request.app.state.nuget_client

    key = f"nuget:{id}"
    data = meta_cache.get(key)
    if data is None:
        client = await nuget.get()
        data = await client.get_registration(id)
        meta_cache.set(key, data)

    return data


@router.get("/nuget/v3/package/{id}/{version}/{filename}")
async def nuget_package_content(
    request: Request, id: str, version: str, filename: str
) -> Response:
    """NuGet PackageBaseAddress — download + cache .nupkg files."""
    nuget_cache: FileCache = request.app.state.nuget_cache
    nuget: SharedNuGetClient = request.app.state.nuget_client
    stats: DownloadStats = request.app.state.download_stats

    dest = nuget_cache.path_for(id.lower(), version.lower(), filename)
    if dest.is_file():
        stats.record(f"nuget:{id}")
        return FileResponse(path=str(dest), filename=filename)

    client = await nuget.get()
    nuget_cache.ensure_parent(dest)
    await client.download_package(id, version, str(dest))
    stats.record(f"nuget:{id}")
    return FileResponse(path=str(dest), filename=filename)


# ── JSON API for frontend UI ───────────────────────────────────────────────────

@router.get("/api/nuget/search")
async def api_nuget_search(
    request: Request,
    q: str = "",
    skip: int = 0,
    take: int = 20,
):
    nuget: SharedNuGetClient = request.app.state.nuget_client
    client = await nuget.get()
    result = await client.search(query=q, skip=skip, take=min(take, 50))
    data = result.get("data") or []
    total = result.get("totalHits", 0)
    has_more = (skip + take) < total
    return {
        "q": q,
        "skip": skip,
        "take": take,
        "totalHits": total,
        "results": data,
        "hasMore": has_more,
    }


@router.get("/api/nuget/package/{id}")
async def api_nuget_package(request: Request, id: str):
    """Return NuGet package info for the UI."""
    meta_cache: MetadataCache = request.app.state.meta_cache
    nuget: SharedNuGetClient = request.app.state.nuget_client

    key = f"nuget:{id}"
    data = meta_cache.get(key)
    if data is None:
        client = await nuget.get()
        data = await client.get_registration(id)
        meta_cache.set(key, data)

    # Flatten registration pages → list of versions + latest info
    all_versions: list[str] = []
    latest_entry: dict = {}
    for page in data.get("items") or []:
        for entry in page.get("items") or []:
            catalog = entry.get("catalogEntry") or {}
            ver = catalog.get("version", "")
            if ver:
                all_versions.append(ver)
            if not latest_entry or ver == all_versions[-1]:
                latest_entry = catalog

    all_versions = list(reversed(all_versions))
    latest_ver = all_versions[0] if all_versions else ""

    return {
        "id": latest_entry.get("id", id),
        "version": latest_ver,
        "description": latest_entry.get("description", ""),
        "authors": latest_entry.get("authors", ""),
        "projectUrl": latest_entry.get("projectUrl", ""),
        "licenseUrl": latest_entry.get("licenseUrl", ""),
        "licenseExpression": latest_entry.get("licenseExpression", ""),
        "tags": latest_entry.get("tags") or [],
        "dependencyGroups": latest_entry.get("dependencyGroups") or [],
        "versions": all_versions,
    }


@router.get("/api/nuget/cached")
async def api_nuget_cached(request: Request):
    nuget_cache: FileCache = request.app.state.nuget_cache
    return {"packages": nuget_cache.list_packages()}
