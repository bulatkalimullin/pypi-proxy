from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse

from app.services.cache import MetadataCache
from app.services.docker_client import DockerError, SharedDockerRegistryClient
from app.services.stats import DownloadStats


router = APIRouter(tags=["docker"])

_DOCKER_API_HEADER = {"Docker-Distribution-API-Version": "registry/2.0"}

_MANIFEST_ACCEPT = (
    "application/vnd.docker.distribution.manifest.v2+json,"
    "application/vnd.docker.distribution.manifest.list.v2+json,"
    "application/vnd.oci.image.manifest.v1+json,"
    "application/vnd.oci.image.index.v1+json,"
    "*/*"
)


def _docker_cache_dir(request: Request) -> Path:
    return request.app.state.docker_cache_dir


def _blob_path(cache_dir: Path, digest: str) -> Path:
    """Store blobs as cache/docker/blobs/{prefix}/{digest}."""
    safe = digest.replace(":", "_")
    prefix = safe[:8]
    return cache_dir / "blobs" / prefix / safe


def _manifest_path(cache_dir: Path, name: str, reference: str) -> Path:
    """Store manifests as cache/docker/manifests/{safe_name}/{reference}."""
    safe_name = name.replace("/", "_").replace(":", "_")
    safe_ref = reference.replace(":", "_")
    return cache_dir / "manifests" / safe_name / safe_ref


def _is_digest(reference: str) -> bool:
    return reference.startswith("sha256:")


# ── Docker Registry v2 Protocol ───────────────────────────────────────────────

@router.get("/v2/")
@router.head("/v2/")
async def registry_version() -> Response:
    """Docker Registry v2 version endpoint. Required for docker client compatibility."""
    return Response(
        content=b"{}",
        media_type="application/json",
        headers=_DOCKER_API_HEADER,
    )


@router.get("/v2/{name:path}/tags/list")
async def get_tags(request: Request, name: str) -> Response:
    """List image tags."""
    meta_cache: MetadataCache = request.app.state.meta_cache
    docker: SharedDockerRegistryClient = request.app.state.docker_client

    key = f"docker_tags:{name}"
    data = meta_cache.get(key)
    if data is None:
        client = await docker.get()
        data = await client.get_tags(name)
        meta_cache.set(key, data)

    return Response(
        content=json.dumps(data).encode(),
        media_type="application/json",
        headers=_DOCKER_API_HEADER,
    )


@router.head("/v2/{name:path}/manifests/{reference}")
async def head_manifest(request: Request, name: str, reference: str) -> Response:
    """Check manifest existence."""
    cache_dir = _docker_cache_dir(request)

    # Check disk cache first
    path = _manifest_path(cache_dir, name, reference)
    if path.is_file():
        meta_file = Path(str(path) + ".meta")
        content_type = "application/vnd.docker.distribution.manifest.v2+json"
        digest = ""
        if meta_file.is_file():
            try:
                m = json.loads(meta_file.read_text())
                content_type = m.get("content_type", content_type)
                digest = m.get("digest", "")
            except Exception:
                pass
        headers = {
            **_DOCKER_API_HEADER,
            "Content-Type": content_type,
            "Content-Length": str(path.stat().st_size),
        }
        if digest:
            headers["Docker-Content-Digest"] = digest
        return Response(headers=headers)

    docker: SharedDockerRegistryClient = request.app.state.docker_client
    client = await docker.get()
    try:
        upstream_headers = await client.head_manifest(name, reference)
    except DockerError as e:
        return Response(status_code=404, headers=_DOCKER_API_HEADER)

    headers = {**_DOCKER_API_HEADER}
    for h in ("Content-Type", "Docker-Content-Digest", "Content-Length"):
        if h in upstream_headers:
            headers[h] = upstream_headers[h]
    return Response(headers=headers)


@router.get("/v2/{name:path}/manifests/{reference}")
async def get_manifest(request: Request, name: str, reference: str) -> Response:
    """Get image manifest, caching to disk."""
    cache_dir = _docker_cache_dir(request)
    path = _manifest_path(cache_dir, name, reference)
    meta_file = Path(str(path) + ".meta")

    if path.is_file():
        content_type = "application/vnd.docker.distribution.manifest.v2+json"
        digest = ""
        if meta_file.is_file():
            try:
                m = json.loads(meta_file.read_text())
                content_type = m.get("content_type", content_type)
                digest = m.get("digest", "")
            except Exception:
                pass
        headers = {**_DOCKER_API_HEADER, "Content-Type": content_type}
        if digest:
            headers["Docker-Content-Digest"] = digest
        return Response(content=path.read_bytes(), media_type=content_type, headers=headers)

    accept = request.headers.get("Accept", _MANIFEST_ACCEPT)
    docker: SharedDockerRegistryClient = request.app.state.docker_client
    client = await docker.get()
    content, content_type, digest = await client.get_manifest(name, reference, accept)

    # Cache if it's a digest reference (immutable) or any manifest
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    meta_file.write_text(json.dumps({"content_type": content_type, "digest": digest}))

    headers = {**_DOCKER_API_HEADER, "Content-Type": content_type}
    if digest:
        headers["Docker-Content-Digest"] = digest
    return Response(content=content, media_type=content_type, headers=headers)


@router.head("/v2/{name:path}/blobs/{digest}")
async def head_blob(request: Request, name: str, digest: str) -> Response:
    """Check blob existence."""
    cache_dir = _docker_cache_dir(request)
    path = _blob_path(cache_dir, digest)

    if path.is_file():
        return Response(
            headers={
                **_DOCKER_API_HEADER,
                "Content-Length": str(path.stat().st_size),
                "Docker-Content-Digest": digest,
                "Content-Type": "application/octet-stream",
            }
        )

    docker: SharedDockerRegistryClient = request.app.state.docker_client
    client = await docker.get()
    upstream_headers = await client.head_blob(name, digest)
    if upstream_headers is None:
        return Response(status_code=404, headers=_DOCKER_API_HEADER)

    headers = {**_DOCKER_API_HEADER, "Docker-Content-Digest": digest}
    if "Content-Length" in upstream_headers:
        headers["Content-Length"] = upstream_headers["Content-Length"]
    return Response(headers=headers)


@router.get("/v2/{name:path}/blobs/{digest}")
async def get_blob(request: Request, name: str, digest: str) -> Response:
    """
    Download a blob. Serves from disk cache if available.
    Otherwise streams from upstream while simultaneously writing to disk (tee).
    """
    cache_dir = _docker_cache_dir(request)
    path = _blob_path(cache_dir, digest)
    stats: DownloadStats = request.app.state.download_stats

    if path.is_file():
        stats.record(f"docker:{name.split('/')[0]}")
        return FileResponse(
            path=str(path),
            media_type="application/octet-stream",
            headers={**_DOCKER_API_HEADER, "Docker-Content-Digest": digest},
        )

    docker: SharedDockerRegistryClient = request.app.state.docker_client
    client = await docker.get()
    upstream = await client.get_blob_stream(name, digest)

    content_length = upstream.headers.get("Content-Length")
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = str(path) + ".part"

    async def tee_generator():
        """Stream blob to client while caching to disk."""
        try:
            with open(tmp_path, "wb") as f:
                async for chunk in upstream.aiter_bytes(65536):
                    if chunk:
                        f.write(chunk)
                        yield chunk
            os.replace(tmp_path, str(path))
            stats.record(f"docker:{name.split('/')[0]}")
        except Exception:
            # Clean up partial file on error
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        finally:
            await upstream.aclose()

    resp_headers = {**_DOCKER_API_HEADER, "Docker-Content-Digest": digest}
    if content_length:
        resp_headers["Content-Length"] = content_length

    return StreamingResponse(
        tee_generator(),
        media_type="application/octet-stream",
        headers=resp_headers,
    )


# ── JSON API for frontend UI ───────────────────────────────────────────────────

@router.get("/api/docker/search")
async def api_docker_search(
    request: Request,
    q: str = "",
    page: int = 1,
    page_size: int = 25,
):
    if not q.strip():
        return {"count": 0, "page": page, "results": [], "hasMore": False}

    docker: SharedDockerRegistryClient = request.app.state.docker_client
    client = await docker.get()
    data = await client.search_hub(query=q, page=page, page_size=page_size)

    results = []
    for item in data.get("results") or []:
        results.append({
            "name": item.get("repo_name") or item.get("name", ""),
            "description": item.get("short_description") or item.get("description", ""),
            "stars": item.get("star_count", 0),
            "pulls": item.get("pull_count", 0),
            "is_official": item.get("is_official", False),
            "is_automated": item.get("is_automated", False),
        })

    total = data.get("count", len(results))
    has_more = page * page_size < total
    return {
        "q": q,
        "page": page,
        "count": total,
        "results": results,
        "hasMore": has_more,
        "nextPage": page + 1 if has_more else None,
    }


@router.get("/api/docker/image/{name:path}")
async def api_docker_image(request: Request, name: str):
    """Return Docker Hub image metadata + recent tags for the UI."""
    meta_cache: MetadataCache = request.app.state.meta_cache
    docker: SharedDockerRegistryClient = request.app.state.docker_client

    key = f"docker_hub_info:{name}"
    cached = meta_cache.get(key)
    if cached:
        return cached

    client = await docker.get()
    try:
        info = await client.get_hub_image_info(name)
    except DockerError as e:
        return {"error": str(e), "name": name}

    try:
        tags_data = await client.get_hub_tags(name, page_size=25)
        tags = [
            {
                "name": t.get("name", ""),
                "last_updated": t.get("last_updated", ""),
                "full_size": t.get("full_size", 0),
                "architectures": [
                    img.get("architecture", "")
                    for img in (t.get("images") or [])
                    if img.get("architecture")
                ],
            }
            for t in (tags_data.get("results") or [])
        ]
    except Exception:
        tags = []

    result = {
        "name": info.get("name", name),
        "namespace": info.get("namespace", "library"),
        "description": info.get("description", ""),
        "full_description": info.get("full_description", ""),
        "star_count": info.get("star_count", 0),
        "pull_count": info.get("pull_count", 0),
        "is_official": info.get("is_official", False),
        "last_updated": info.get("last_updated", ""),
        "tags": tags,
    }
    meta_cache.set(key, result)
    return result


@router.get("/api/docker/cached")
async def api_docker_cached(request: Request):
    """List cached Docker image names (by manifest directories)."""
    cache_dir = _docker_cache_dir(request)
    manifests_dir = cache_dir / "manifests"
    if not manifests_dir.exists():
        return {"images": []}
    images = sorted([d.name for d in manifests_dir.iterdir() if d.is_dir()])
    return {"images": images}


@router.delete("/api/docker/cache")
async def api_docker_clear_cache(request: Request) -> dict[str, str]:
    """Clear all Docker cache (admin protected)."""
    from app.routers.api import _require_admin
    from fastapi.security import HTTPBasicCredentials
    # Inline admin check
    _require_admin(request, _get_basic_credentials(request))

    cache_dir = _docker_cache_dir(request)
    if cache_dir.exists():
        shutil.rmtree(cache_dir, ignore_errors=True)
        cache_dir.mkdir(parents=True, exist_ok=True)
    meta_cache: MetadataCache = request.app.state.meta_cache
    for key in list(meta_cache._store.keys()):
        if key.startswith("docker"):
            meta_cache._store.pop(key, None)
    return {"status": "cleared"}


@router.delete("/api/docker/cache/{name:path}")
async def api_docker_clear_image(request: Request, name: str) -> dict[str, str]:
    """Clear cached manifests for a specific Docker image (admin protected)."""
    _require_admin(request, _get_basic_credentials(request))

    cache_dir = _docker_cache_dir(request)
    safe_name = name.replace("/", "_").replace(":", "_")
    manifest_dir = cache_dir / "manifests" / safe_name
    if manifest_dir.exists():
        shutil.rmtree(manifest_dir, ignore_errors=True)

    meta_cache: MetadataCache = request.app.state.meta_cache
    for key in list(meta_cache._store.keys()):
        if key.startswith(f"docker_tags:{name}") or key.startswith(f"docker_hub_info:{name}"):
            meta_cache._store.pop(key, None)
    return {"status": "deleted", "name": name}


def _require_admin(request: Request, credentials) -> None:
    """Inline admin check (avoids circular import)."""
    import secrets
    from fastapi import HTTPException
    password = request.app.state.settings.admin_password
    if not password:
        return
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


def _get_basic_credentials(request: Request):
    """Extract HTTP Basic credentials from request headers."""
    import base64
    from fastapi.security import HTTPBasicCredentials
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Basic "):
        return None
    try:
        decoded = base64.b64decode(auth[6:]).decode()
        username, _, password = decoded.partition(":")
        return HTTPBasicCredentials(username=username, password=password)
    except Exception:
        return None
