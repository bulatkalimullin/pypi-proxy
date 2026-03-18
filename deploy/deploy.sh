#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[deploy] pulling latest code..."
git fetch --all --prune
git reset --hard "origin/main"

echo "[deploy] ensuring docker network..."
docker network create pypi-net >/dev/null 2>&1 || true

echo "[deploy] rebuilding images..."
docker build -t pypi_backend:latest -f Dockerfile.backend .
docker build -t pypi_frontend:latest -f frontend/Dockerfile frontend

echo "[deploy] restarting containers..."
docker rm -f backend frontend 2>/dev/null || true
docker run -d --name backend --network pypi-net -p 8888:8888 \
  -e PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://lab.webflare.ru:8888}" \
  -v "$ROOT_DIR/cache:/app/cache" \
  pypi_backend:latest

docker run -d --name frontend --network pypi-net -p 5173:5173 pypi_frontend:latest

echo "[deploy] done"
