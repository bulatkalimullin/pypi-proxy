from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response, StreamingResponse

from app.services.cache import FileCache, MetadataCache
from app.services.stats import DownloadStats
from app.services.vscode_extensions_client import SharedVsCodeExtensionsClient, VsCodeExtensionsError


router = APIRouter(tags=["vscode-extensions"])


def _extensions_cache(request: Request) -> FileCache:
    return request.app.state.extensions_cache


def _extensions_key(publisher: str, name: str) -> str:
    return f"extensions:{publisher}.{name}"


def _to_gallery_extension(ext: dict[str, Any], base_url: str) -> dict[str, Any]:
    publisher = ext.get("publisher", "")
    name = ext.get("name", "")
    display_name = ext.get("displayName") or name
    versions = ext.get("versions") or []
    gallery_versions: list[dict[str, Any]] = []
    for ver in versions[:5]:
        version = ver.get("version", "")
        vsix_path = ver.get("vsixAssetPath") or f"/extensions/vsix/{publisher}/{name}/{version}.vsix"
        icon_url = ext.get("logoUrl", "")
        files = [
            {
                "assetType": "Microsoft.VisualStudio.Services.VSIXPackage",
                "source": f"{base_url}{vsix_path}",
            }
        ]
        if icon_url:
            files.append(
                {
                    "assetType": "Microsoft.VisualStudio.Services.Icons.Default",
                    "source": icon_url,
                }
            )
        gallery_versions.append(
            {
                "version": version,
                "lastUpdated": ver.get("lastUpdated", ""),
                "files": files,
            }
        )
    return {
        "publisher": {"publisherName": publisher, "displayName": publisher},
        "extensionName": name,
        "displayName": display_name,
        "shortDescription": ext.get("description", ""),
        "flags": "none",
        "versions": gallery_versions,
        "statistics": [
            {"statisticName": "install", "value": int(ext.get("installs", 0) or 0)},
            {"statisticName": "averagerating", "value": float(ext.get("rating", 0) or 0)},
            {"statisticName": "ratingcount", "value": int(ext.get("ratingCount", 0) or 0)},
        ],
        "categories": ext.get("categories") or [],
        "tags": ext.get("tags") or [],
    }


@router.get("/api/extensions/search")
async def extensions_search(
    request: Request,
    q: str = "",
    page: int = 1,
    limit: int = 20,
    min_rating: float = 0.0,
    verified: bool = False,
    category: str = "",
    sort: str = "relevance",
):
    if not q.strip():
        return {"q": q, "page": page, "results": [], "count": 0, "hasMore": False}
    cache: MetadataCache = request.app.state.meta_cache
    key = f"ext_search:{q}:{page}:{limit}:{min_rating}:{verified}:{category}:{sort}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    shared: SharedVsCodeExtensionsClient = request.app.state.extensions_client
    client = await shared.get()
    data = await client.search(
        query=q,
        page=page,
        page_size=min(limit, 50),
        min_rating=min_rating,
        verified_only=verified,
        category=category,
        sort_by=sort,
    )
    cache.set(key, data)
    return data


@router.get("/api/extensions/{publisher}/{name}")
async def extension_detail(request: Request, publisher: str, name: str, source: str = "auto"):
    cache: MetadataCache = request.app.state.meta_cache
    key = f"ext_detail:{publisher}.{name}"
    cached = cache.get(key)
    if cached is not None:
        return cached
    shared: SharedVsCodeExtensionsClient = request.app.state.extensions_client
    client = await shared.get()
    try:
        data = await client.get_extension(publisher, name, source=source)
    except VsCodeExtensionsError as exc:
        return JSONResponse(status_code=404, content={"error": str(exc), "id": f"{publisher}.{name}"})
    cache.set(key, data)
    data["builtInInstallSource"] = "openvsx"
    return data


@router.get("/api/extensions/{publisher}/{name}/versions")
async def extension_versions(request: Request, publisher: str, name: str, source: str = "auto"):
    shared: SharedVsCodeExtensionsClient = request.app.state.extensions_client
    client = await shared.get()
    try:
        versions = await client.get_versions(publisher, name, source=source)
    except VsCodeExtensionsError as exc:
        return JSONResponse(status_code=404, content={"error": str(exc), "id": f"{publisher}.{name}"})
    return {"id": f"{publisher}.{name}", "versions": versions}


@router.get("/api/extensions/{publisher}/{name}/download")
async def extension_download_latest(request: Request, publisher: str, name: str):
    shared: SharedVsCodeExtensionsClient = request.app.state.extensions_client
    client = await shared.get()
    try:
        download_url = await client.get_latest_download(publisher, name, source="openvsx")
    except VsCodeExtensionsError as exc:
        return JSONResponse(status_code=404, content={"error": str(exc), "id": f"{publisher}.{name}"})
    return RedirectResponse(url=download_url, status_code=302)


@router.get("/extensions/vsix/{publisher}/{name}/{version}.vsix")
async def extension_vsix(request: Request, publisher: str, name: str, version: str):
    cache = _extensions_cache(request)
    stats: DownloadStats = request.app.state.download_stats
    stats_key = _extensions_key(publisher, name)
    file_name = f"{publisher}.{name}-{version}.vsix"
    dest = cache.path_for(f"{publisher}__{name}", "files", file_name)
    if dest.is_file():
        stats.record(stats_key)
        return FileResponse(
            path=str(dest),
            media_type="application/octet-stream",
            filename=file_name,
            headers={"Cache-Control": "public, max-age=86400"},
        )

    shared: SharedVsCodeExtensionsClient = request.app.state.extensions_client
    client = await shared.get()
    detail = await client.get_extension(publisher, name, source="openvsx")
    versions = detail.get("versions") or []
    selected = next((v for v in versions if v.get("version") == version), None)
    if selected is None:
        return JSONResponse(status_code=404, content={"error": "Version not found", "version": version})
    download_url = selected.get("downloadUrl", "")
    if not download_url:
        return JSONResponse(status_code=404, content={"error": "Download URL not found", "version": version})

    cache.ensure_parent(dest)
    tmp_path = Path(str(dest) + ".part")
    resp = await client.open_download_stream(download_url)

    content_length = resp.headers.get("content-length")
    headers: dict[str, str] = {"Cache-Control": "public, max-age=86400"}
    if content_length:
        headers["Content-Length"] = content_length

    async def _stream_and_cache():
        out = None
        try:
            out = open(tmp_path, "wb")
            async for chunk in resp.aiter_bytes(131072):
                if chunk:
                    out.write(chunk)
                    yield chunk
            out.close()
            out = None
            os.replace(str(tmp_path), str(dest))
            stats.record(stats_key)
        except Exception:
            if out is not None:
                out.close()
            try:
                os.unlink(str(tmp_path))
            except OSError:
                pass
            raise
        finally:
            await resp.aclose()

    return StreamingResponse(
        _stream_and_cache(),
        media_type="application/octet-stream",
        headers={
            **headers,
            "Content-Disposition": f'attachment; filename="{file_name}"',
        },
    )


@router.get("/extensions/install.sh")
async def extensions_install_script(request: Request):
    """One-liner install script: curl -sL <proxy>/extensions/install.sh | bash -s <ext.id>"""
    base_url = request.app.state.settings.public_base_url or ""
    script = f"""#!/usr/bin/env bash
set -euo pipefail

PROXY="{base_url}"

usage() {{
  echo "Usage:"
  echo "  curl -sL $PROXY/extensions/install.sh | bash -s -- <publisher.name> [version]"
  echo "  curl -sL $PROXY/extensions/install.sh | bash -s -- --list python"
  echo "  curl -sL $PROXY/extensions/install.sh | bash -s -- --setup"
  echo ""
  echo "Examples:"
  echo "  curl -sL $PROXY/extensions/install.sh | bash -s -- ms-python.python"
  echo "  curl -sL $PROXY/extensions/install.sh | bash -s -- ms-python.python 2024.0.1"
  exit 0
}}

detect_editor() {{
  if command -v code &>/dev/null; then echo "code"
  elif command -v codium &>/dev/null; then echo "codium"
  elif command -v cursor &>/dev/null; then echo "cursor"
  elif command -v code-server &>/dev/null; then echo "code-server"
  else echo ""; fi
}}

setup_marketplace() {{
  EDITOR=$(detect_editor)
  if [ -z "$EDITOR" ]; then
    echo "No VS Code-compatible editor found in PATH."
    exit 1
  fi
  echo "Detected editor: $EDITOR"
  echo ""
  echo "To use this proxy as your extension marketplace, add to settings.json:"
  echo ""
  echo '  "extensions.gallery": {{'
  echo '    "serviceUrl": "'$PROXY'/_apis/public/gallery",'
  echo '    "itemUrl": "'$PROXY'/extensions"'
  echo '  }}'
  echo ""
  echo "Then restart your editor."
}}

search_extensions() {{
  local query="$1"
  curl -sf "$PROXY/api/extensions/search?q=$query&limit=10" | \\
    python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data.get('results', []):
    stars = r.get('rating', 0)
    dl = r.get('installs', 0)
    print(f\\"  {{r['id']:40s}}  ★ {{stars:.1f}}  ↓ {{dl}}\\")" 2>/dev/null || \\
    curl -sf "$PROXY/api/extensions/search?q=$query&limit=10"
}}

install_extension() {{
  local EXT_ID="$1"
  local VERSION="${{2:-}}"
  local PUBLISHER="${{EXT_ID%%.*}}"
  local NAME="${{EXT_ID#*.}}"

  if [ -z "$PUBLISHER" ] || [ -z "$NAME" ] || [ "$PUBLISHER" = "$NAME" ]; then
    echo "Invalid extension ID: $EXT_ID (expected: publisher.name)"
    exit 1
  fi

  EDITOR=$(detect_editor)

  if [ -n "$EDITOR" ]; then
    echo "Installing $EXT_ID via $EDITOR CLI..."
    if $EDITOR --install-extension "$EXT_ID" 2>/dev/null; then
      echo "Done."
      exit 0
    fi
    echo "CLI install failed, falling back to VSIX download..."
  fi

  if [ -z "$VERSION" ]; then
    echo "Resolving latest version..."
    VERSION=$(curl -sf "$PROXY/api/extensions/$PUBLISHER/$NAME" | \\
      python3 -c "import sys,json; v=json.load(sys.stdin).get('versions',[]); print(v[0]['version'] if v else '')" 2>/dev/null)
    if [ -z "$VERSION" ]; then
      echo "Could not resolve latest version for $EXT_ID"
      exit 1
    fi
    echo "Latest version: $VERSION"
  fi

  local VSIX_URL="$PROXY/extensions/vsix/$PUBLISHER/$NAME/$VERSION.vsix"
  local VSIX_FILE="${{EXT_ID}}-${{VERSION}}.vsix"

  echo "Downloading $VSIX_FILE..."
  curl -fL "$VSIX_URL" -o "$VSIX_FILE"

  if [ -n "$EDITOR" ]; then
    echo "Installing VSIX..."
    $EDITOR --install-extension "./$VSIX_FILE"
    rm -f "$VSIX_FILE"
    echo "Done."
  else
    echo "Downloaded: $VSIX_FILE"
    echo "Install manually: code --install-extension ./$VSIX_FILE"
  fi
}}

[ $# -eq 0 ] && usage

case "$1" in
  -h|--help) usage ;;
  --setup) setup_marketplace ;;
  --list|--search) shift; search_extensions "$@" ;;
  *) install_extension "$@" ;;
esac
"""
    return Response(
        content=script,
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": "inline; filename=install.sh",
            "Cache-Control": "public, max-age=3600",
        },
    )


@router.get("/extensions/feed/index.json")
async def extensions_feed_index(request: Request):
    base_url = request.app.state.settings.public_base_url or ""
    return {
        "name": "Pkg Proxy VSCode Extensions Feed (Open VSX primary)",
        "source": "openvsx",
        "signinRequired": False,
        "officialVSCode": {
            "serviceUrl": f"{base_url}/_apis/public/gallery",
            "itemUrl": f"{base_url}/extensions",
            "controlUrl": f"{base_url}/extensions/gallery/control",
            "recommendationsUrl": f"{base_url}/extensions/gallery/recommendations",
        },
        "search": f"{base_url}/api/extensions/search?q={{query}}&page={{page}}&limit={{limit}}",
        "detail": f"{base_url}/api/extensions/{{publisher}}/{{name}}",
        "versions": f"{base_url}/api/extensions/{{publisher}}/{{name}}/versions",
        "vsix": f"{base_url}/extensions/vsix/{{publisher}}/{{name}}/{{version}}.vsix",
    }


@router.get("/api/extensions/cached")
async def extensions_cached(request: Request):
    ext_cache: FileCache = request.app.state.extensions_cache
    return {"packages": ext_cache.list_packages()}


@router.get("/extensions/feed/official-vscode-config.json")
async def official_vscode_config(request: Request):
    base_url = request.app.state.settings.public_base_url or ""
    return JSONResponse(content={
        "extensionsGallery": {
            "serviceUrl": f"{base_url}/_apis/public/gallery",
            "itemUrl": f"{base_url}/extensions",
            "controlUrl": f"{base_url}/extensions/gallery/control",
            "recommendationsUrl": f"{base_url}/extensions/gallery/recommendations",
        },
        "settingsOverride": {
            "extensions.gallery": {
                "serviceUrl": f"{base_url}/_apis/public/gallery",
                "itemUrl": f"{base_url}/extensions",
            }
        },
    }, headers={"Cache-Control": "public, max-age=3600"})


@router.get("/extensions/gallery/control")
async def extensions_gallery_control():
    return {"malicious": [], "deprecated": [], "searchDisabled": False}


@router.get("/extensions/gallery/recommendations")
async def extensions_gallery_recommendations():
    return {"workspaceRecommendations": [], "fileBasedRecommendations": [], "importantRecommendations": []}


@router.post("/_apis/public/gallery/extensionquery")
async def gallery_extension_query(request: Request):
    payload = await request.json()
    filters = (payload.get("filters") or [{}])[0]
    criteria = filters.get("criteria") or []
    query = ""
    extension_id = ""
    for c in criteria:
        filter_type = int(c.get("filterType", 0))
        value = str(c.get("value", "")).strip()
        if filter_type == 10:
            query = value
        elif filter_type == 7:
            extension_id = value

    page = int(filters.get("pageNumber", 1) or 1)
    page_size = int(filters.get("pageSize", 20) or 20)

    shared: SharedVsCodeExtensionsClient = request.app.state.extensions_client
    client = await shared.get()
    base_url = request.app.state.settings.public_base_url or ""

    extensions: list[dict[str, Any]] = []
    total_count = 0

    if extension_id and "." in extension_id:
        publisher, name = extension_id.split(".", 1)
        try:
            ext = await client.get_extension(publisher, name, source="openvsx")
            extensions = [_to_gallery_extension(ext, base_url)]
            total_count = 1
        except VsCodeExtensionsError:
            extensions = []
            total_count = 0
    else:
        result = await client.search(
            query=query,
            page=page,
            page_size=min(page_size, 50),
            source="openvsx",
        )
        total_count = int(result.get("count", 0) or 0)
        extensions = [_to_gallery_extension(ext, base_url) for ext in (result.get("results") or [])]

    return {
        "results": [
            {
                "extensions": extensions,
                "pagingToken": None,
                "resultMetadata": [
                    {
                        "metadataType": "ResultCount",
                        "metadataItems": [{"name": "TotalCount", "count": total_count}],
                    }
                ],
            }
        ]
    }
