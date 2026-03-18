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


def get_settings() -> Settings:
    cache_dir = Path(os.getenv("CACHE_DIR", "cache")).resolve()
    metadata_ttl_seconds = int(os.getenv("METADATA_TTL_SECONDS", "900"))
    pypi_base_url = os.getenv("PYPI_BASE_URL", "https://pypi.org").rstrip("/")
    simple_index_ttl_seconds = int(os.getenv("SIMPLE_INDEX_TTL_SECONDS", "86400"))
    public_base_url = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
    return Settings(
        cache_dir=cache_dir,
        metadata_ttl_seconds=metadata_ttl_seconds,
        pypi_base_url=pypi_base_url,
        simple_index_ttl_seconds=simple_index_ttl_seconds,
        public_base_url=public_base_url,
    )
