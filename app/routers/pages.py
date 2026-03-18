from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from markdown import markdown as md_to_html

from app.services.cache import MetadataCache
from app.services.pypi_client import PyPIError, SharedPyPIClient


router = APIRouter()


def _render_description(info: dict[str, Any]) -> str:
    text = (info.get("description") or "").strip()
    if not text:
        return ""
    content_type = (info.get("description_content_type") or "").lower()
    if "markdown" in content_type:
        return md_to_html(text, extensions=["fenced_code", "tables"])
    return text


@router.get("/", response_class=HTMLResponse)
async def index(request: Request) -> HTMLResponse:
    templates: Jinja2Templates = request.app.state.templates
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/search", response_class=HTMLResponse)
async def search(request: Request, q: str = "", page: int = 1) -> HTMLResponse:
    templates: Jinja2Templates = request.app.state.templates
    pypi: SharedPyPIClient = request.app.state.pypi
    query = (q or "").strip()
    page = max(1, int(page))

    results = []
    error = None
    if query:
        try:
            client = await pypi.get()
            results = await client.search(query=query, page=page)
        except Exception as e:  # noqa: BLE001
            error = str(e)

    return templates.TemplateResponse(
        "search.html",
        {"request": request, "q": query, "page": page, "results": results, "error": error},
    )


@router.get("/package/{name}", response_class=HTMLResponse)
async def package(request: Request, name: str) -> HTMLResponse:
    templates: Jinja2Templates = request.app.state.templates
    pypi: SharedPyPIClient = request.app.state.pypi
    cache: MetadataCache = request.app.state.meta_cache
    settings = request.app.state.settings

    key = f"pkg:{name}"
    data = cache.get(key)
    error = None

    if data is None:
        try:
            client = await pypi.get()
            data = await client.get_package_json(name)
            cache.set(key, data)
        except PyPIError as e:
            error = str(e)
        except Exception as e:  # noqa: BLE001
            error = str(e)

    if error or not data:
        return templates.TemplateResponse(
            "package.html",
            {"request": request, "name": name, "error": error or "Unknown error"},
            status_code=404,
        )

    info = data.get("info") or {}
    releases = data.get("releases") or {}
    versions = sorted(releases.keys(), reverse=True)
    rendered_description = _render_description(info)
    is_markdown = "markdown" in (info.get("description_content_type") or "").lower()
    public_base_url = settings.public_base_url or str(request.base_url).rstrip("/")
    public_host = urlparse(public_base_url).hostname or public_base_url

    return templates.TemplateResponse(
        "package.html",
        {
            "request": request,
            "name": name,
            "info": info,
            "versions": versions,
            "rendered_description": rendered_description,
            "description_is_markdown": is_markdown,
            "public_base_url": public_base_url,
            "public_host": public_host,
            "error": None,
        },
    )


@router.get("/package/{name}/{version}", response_class=HTMLResponse)
async def version(request: Request, name: str, version: str) -> HTMLResponse:
    templates: Jinja2Templates = request.app.state.templates
    pypi: SharedPyPIClient = request.app.state.pypi
    cache: MetadataCache = request.app.state.meta_cache

    key = f"ver:{name}:{version}"
    data = cache.get(key)
    error = None

    if data is None:
        try:
            client = await pypi.get()
            data = await client.get_version_json(name, version)
            cache.set(key, data)
        except PyPIError as e:
            error = str(e)
        except Exception as e:  # noqa: BLE001
            error = str(e)

    if error or not data:
        return templates.TemplateResponse(
            "version.html",
            {"request": request, "name": name, "version": version, "error": error or "Unknown error"},
            status_code=404,
        )

    info = data.get("info") or {}
    urls = data.get("urls") or []
    requires_dist = info.get("requires_dist") or []

    return templates.TemplateResponse(
        "version.html",
        {
            "request": request,
            "name": name,
            "version": version,
            "info": info,
            "urls": urls,
            "requires_dist": requires_dist,
            "error": None,
        },
    )
