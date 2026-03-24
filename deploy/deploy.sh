#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DOMAIN="${DOMAIN:-lab.webflare.ru}"
LISTEN_IP="${LISTEN_IP:-194.87.189.114}"

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

# Restart reverse-proxy (nginx)
docker rm -f pypi-nginx 2>/dev/null || true

CERT_FULLCHAIN="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
CERT_PRIVKEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
if [ -f "$CERT_FULLCHAIN" ] && [ -f "$CERT_PRIVKEY" ]; then
  NGINX_TEMPLATE="$ROOT_DIR/deploy/nginx-pypi.full.conf"
  PUBLIC_BASE_URL_EFFECTIVE="https://$DOMAIN"
else
  NGINX_TEMPLATE="$ROOT_DIR/deploy/nginx-pypi.http.conf"
  PUBLIC_BASE_URL_EFFECTIVE="http://$DOMAIN"
fi

NGINX_CONF_RENDERED="$ROOT_DIR/deploy/nginx-pypi.rendered.conf"
sed "s|__DOMAIN__|$DOMAIN|g" "$NGINX_TEMPLATE" > "$NGINX_CONF_RENDERED"

docker run -d --name backend --network pypi-net -p 8888:8888 \
  -e PUBLIC_BASE_URL="$PUBLIC_BASE_URL_EFFECTIVE" \
  -v "$ROOT_DIR/cache:/app/cache" \
  pypi_backend:latest

docker run -d --name frontend --network pypi-net -p 5173:5173 \
  -e VITE_PUBLIC_BASE_URL="$PUBLIC_BASE_URL_EFFECTIVE" \
  pypi_frontend:latest

docker run -d --name pypi-nginx --network pypi-net \
  -p "${LISTEN_IP}:80:80" -p "${LISTEN_IP}:443:443" \
  -v "/etc/letsencrypt:/etc/letsencrypt:ro" \
  -v "/var/www/certbot:/var/www/certbot:ro" \
  -v "$NGINX_CONF_RENDERED:/etc/nginx/conf.d/default.conf:ro" \
  --restart unless-stopped \
  nginx:1.27-alpine

echo "[deploy] done"
