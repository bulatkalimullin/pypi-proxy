from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    cache_dir: Path
    metadata_ttl_seconds: int
    pypi_base_url: str
    simple_index_ttl_seconds: int
    public_base_url: str
    admin_password: str
    npm_registry_url: str
    nuget_registry_url: str
    docker_registry_url: str
    docker_auth_url: str


def get_settings() -> Settings:
    cache_dir = Path(os.getenv("CACHE_DIR", "cache")).resolve()
    metadata_ttl_seconds = int(os.getenv("METADATA_TTL_SECONDS", "900"))
    pypi_base_url = os.getenv("PYPI_BASE_URL", "https://pypi.org").rstrip("/")
    simple_index_ttl_seconds = int(os.getenv("SIMPLE_INDEX_TTL_SECONDS", "86400"))
    public_base_url = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
    admin_password = os.getenv("ADMIN_PASSWORD", "")
    npm_registry_url = os.getenv("NPM_REGISTRY_URL", "https://registry.npmjs.org").rstrip("/")
    nuget_registry_url = os.getenv("NUGET_REGISTRY_URL", "https://api.nuget.org").rstrip("/")
    docker_registry_url = os.getenv("DOCKER_REGISTRY_URL", "https://registry-1.docker.io").rstrip("/")
    docker_auth_url = os.getenv("DOCKER_AUTH_URL", "https://auth.docker.io/token")
    return Settings(
        cache_dir=cache_dir,
        metadata_ttl_seconds=metadata_ttl_seconds,
        pypi_base_url=pypi_base_url,
        simple_index_ttl_seconds=simple_index_ttl_seconds,
        public_base_url=public_base_url,
        admin_password=admin_password,
        npm_registry_url=npm_registry_url,
        nuget_registry_url=nuget_registry_url,
        docker_registry_url=docker_registry_url,
        docker_auth_url=docker_auth_url,
    )
