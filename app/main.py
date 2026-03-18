from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates

from app.config import get_settings
from app.routers import api, downloads, pages, simple
from app.services.cache import FileCache, MetadataCache
from app.services.pypi_client import SharedPyPIClient
from app.services.simple_index import SimpleIndex, SimpleIndexSettings


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    settings.cache_dir.mkdir(parents=True, exist_ok=True)
    app.state.settings = settings
    app.state.meta_cache = MetadataCache(ttl_seconds=settings.metadata_ttl_seconds)
    app.state.file_cache = FileCache(root_dir=settings.cache_dir)
    app.state.pypi = SharedPyPIClient(base_url=settings.pypi_base_url)
    app.state.simple_index = SimpleIndex(
        SimpleIndexSettings(
            base_url=settings.pypi_base_url,
            cache_path=settings.cache_dir / "simple-index.txt",
            ttl_seconds=settings.simple_index_ttl_seconds,
        )
    )

    templates_dir = Path(__file__).parent / "templates"
    app.state.templates = Jinja2Templates(directory=str(templates_dir))

    yield

    await app.state.pypi.aclose()


app = FastAPI(title="PyPI Web UI", lifespan=lifespan)

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
