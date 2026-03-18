from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

from app.services.cache import MetadataCache
from app.services.pypi_client import SharedPyPIClient
from app.services.simple_index import SimpleIndex


router = APIRouter()


def _pep503_html(title: str, links: list[tuple[str, str]]) -> str:
    # Minimal PEP 503 page (pip parses anchor tags).
    # links: [(href, text)]
    items = "\n".join([f'<a href="{href}">{text}</a><br/>' for href, text in links])
    return f"<!doctype html><html><head><meta charset='utf-8'><title>{title}</title></head><body>{items}</body></html>"


@router.get("/simple/", response_class=HTMLResponse)
async def simple_index(request: Request) -> HTMLResponse:
    idx: SimpleIndex = request.app.state.simple_index
    await idx.ensure_updated()
    links = []
    for name in idx.iter_names():
        links.append((f"/simple/{name}/", name))
    return HTMLResponse(_pep503_html("Simple Index", links))


@router.get("/simple/{name}/", response_class=HTMLResponse)
async def simple_project(request: Request, name: str) -> HTMLResponse:
    """
    Serve a project page with links to distributions.
    We point to our own /download/... endpoints to enable server-side caching.
    """
    pypi: SharedPyPIClient = request.app.state.pypi
    cache: MetadataCache = request.app.state.meta_cache

    # Fetch package JSON (cached)
    pkg_key = f"pkg:{name}"
    pkg = cache.get(pkg_key)
    if pkg is None:
        client = await pypi.get()
        pkg = await client.get_package_json(name)
        cache.set(pkg_key, pkg)

    releases: dict[str, Any] = pkg.get("releases") or {}
    links: list[tuple[str, str]] = []

    # PEP 503: any file links are acceptable; pip selects best match.
    for ver, files in releases.items():
        for f in files or []:
            filename = f.get("filename")
            if not filename:
                continue
            href = f"/download/{name}/{ver}/{filename}"
            links.append((href, filename))

    return HTMLResponse(_pep503_html(f"Simple: {name}", links))

