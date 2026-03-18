from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates

from app.config import get_settings
from app.routers import api, docker, downloads, npm, nuget, pages, simple
from app.services.cache import FileCache, MetadataCache
from app.services.docker_client import SharedDockerRegistryClient
from app.services.npm_client import SharedNpmClient
from app.services.nuget_client import SharedNuGetClient
from app.services.pypi_client import SharedPyPIClient
from app.services.simple_index import SimpleIndex, SimpleIndexSettings
from app.services.stats import DownloadStats


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    settings.cache_dir.mkdir(parents=True, exist_ok=True)
    app.state.settings = settings
    app.state.meta_cache = MetadataCache(ttl_seconds=settings.metadata_ttl_seconds)
    app.state.file_cache = FileCache(root_dir=settings.cache_dir)
    app.state.npm_cache = FileCache(root_dir=settings.cache_dir / "npm")
    app.state.nuget_cache = FileCache(root_dir=settings.cache_dir / "nuget")

    docker_cache_dir = settings.cache_dir / "docker"
    docker_cache_dir.mkdir(parents=True, exist_ok=True)
    app.state.docker_cache_dir = docker_cache_dir

    app.state.pypi = SharedPyPIClient(base_url=settings.pypi_base_url)
    app.state.npm_client = SharedNpmClient(
        registry_url=settings.npm_registry_url,
        public_base_url=settings.public_base_url,
    )
    app.state.nuget_client = SharedNuGetClient(
        registry_url=settings.nuget_registry_url,
        public_base_url=settings.public_base_url,
    )
    app.state.docker_client = SharedDockerRegistryClient(
        registry_url=settings.docker_registry_url,
        auth_url=settings.docker_auth_url,
    )
    app.state.simple_index = SimpleIndex(
        SimpleIndexSettings(
            base_url=settings.pypi_base_url,
            cache_path=settings.cache_dir / "simple-index.txt",
            ttl_seconds=settings.simple_index_ttl_seconds,
        )
    )
    app.state.download_stats = DownloadStats(stats_path=settings.cache_dir / "stats.json")

    templates_dir = Path(__file__).parent / "templates"
    app.state.templates = Jinja2Templates(directory=str(templates_dir))

    yield

    await app.state.pypi.aclose()
    await app.state.npm_client.aclose()
    await app.state.nuget_client.aclose()
    await app.state.docker_client.aclose()


app = FastAPI(title="Package Proxy", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pages.router)
app.include_router(downloads.router)
app.include_router(api.router)
app.include_router(simple.router)
app.include_router(npm.router)
app.include_router(nuget.router)
app.include_router(docker.router)
