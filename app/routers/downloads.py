from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, RedirectResponse, Response

from app.services.cache import FileCache, MetadataCache
from app.services.pypi_client import PyPIError, SharedPyPIClient


router = APIRouter()


def _find_file_url(version_json: dict[str, Any], filename: str) -> Optional[str]:
    for item in version_json.get("urls") or []:
        if item.get("filename") == filename and item.get("url"):
            return item["url"]
    return None


@router.get("/download/{name}/{version}/{filename}")
async def download(request: Request, name: str, version: str, filename: str) -> Response:
    file_cache: FileCache = request.app.state.file_cache
    meta_cache: MetadataCache = request.app.state.meta_cache
    pypi: SharedPyPIClient = request.app.state.pypi

    dest: Path = file_cache.path_for(name, version, filename)
    if dest.is_file():
        return FileResponse(path=str(dest), filename=filename)

    key = f"ver:{name}:{version}"
    data = meta_cache.get(key)
    if data is None:
        client = await pypi.get()
        data = await client.get_version_json(name, version)
        meta_cache.set(key, data)

    url = _find_file_url(data, filename)
    if not url:
        raise PyPIError("File not found for this version")

    client = await pypi.get()
    file_cache.ensure_parent(dest)
    await client.download_file(url=url, dest_path=str(dest))
    return FileResponse(path=str(dest), filename=filename)


@router.get("/download/latest/{name}")
async def download_latest_redirect(request: Request, name: str) -> Response:
    """
    Convenience redirect: goes to the package page (user can pick a file).
    """
    return RedirectResponse(url=f"/package/{name}")
