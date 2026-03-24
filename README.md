# FastAPI PyPI Web UI (Proxy + Cache)

Веб-интерфейс для поиска пакетов на PyPI, просмотра версий/метаданных и скачивания `.whl` / `.tar.gz` через ваш сервер с кэшированием на диске.

## Запуск

### Docker (frontend 5173, backend 8888)

```bash
# Если у вас docker-compose v1:
docker-compose up --build
```

- Frontend: `http://<your-host>:5173`
- Backend: `http://<your-host>:8888`
- pip index: `https://<your-host>/simple/`

### Локально (без Docker)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8888 --reload
```

Откройте `http://<your-host>:8888`.

## Переменные окружения

- `CACHE_DIR` (по умолчанию `./cache`): директория для кэша файлов
- `METADATA_TTL_SECONDS` (по умолчанию `900`): TTL для кэша метаданных (пакет/версия)
- `PYPI_BASE_URL` (по умолчанию `https://pypi.org`): базовый URL PyPI
- `PUBLIC_BASE_URL` (например `https://lab.webflare.ru`): публичный URL бэка (для команд `pip install`)

## CI/CD (GitHub Actions → автодеплой на сервер)

В репозитории добавлен workflow: `[.github/workflows/deploy.yml](.github/workflows/deploy.yml)`.

Он запускается на каждый `push` в `main`, подключается по SSH к серверу и выполняет `[deploy/deploy.sh](deploy/deploy.sh)`:
- `git reset --hard origin/main`
- `docker build ...`
- перезапуск контейнеров `backend` (8888) и `frontend` (5173)

### Нужные Secrets в GitHub

В `Settings → Secrets and variables → Actions` добавьте:
- `DEPLOY_HOST` (например `lab.webflare.ru`)
- `DEPLOY_USER` (например `root`)
- `DEPLOY_PORT` (например `22`)
- `DEPLOY_SSH_KEY` (приватный SSH ключ)

## Official VS Code without Sign in (через proxy)

Если в официальном VS Code вы видите `Sign in to access Marketplace`, клиент все еще ходит в Microsoft Marketplace.
Для полного переключения на ваш proxy нужно патчить `product.json` (одного `settings.json` часто недостаточно).

### 1) Patch `extensionsGallery`

```json
{
  "extensionsGallery": {
    "serviceUrl": "https://packages.webflare.ru/_apis/public/gallery",
    "itemUrl": "https://packages.webflare.ru/extensions",
    "controlUrl": "https://packages.webflare.ru/extensions/gallery/control",
    "recommendationsUrl": "https://packages.webflare.ru/extensions/gallery/recommendations"
  }
}
```

### 2) Пути к `product.json`

```text
Linux (deb/rpm): /usr/share/code/resources/app/product.json
Linux (tar.gz): <VS_CODE_DIR>/resources/app/product.json
macOS: /Applications/Visual Studio Code.app/Contents/Resources/app/product.json
Windows (system): C:\Program Files\Microsoft VS Code\resources\app\product.json
Windows (user): %LocalAppData%\Programs\Microsoft VS Code\resources\app\product.json
```

### 3) Быстрая проверка endpoint

```bash
curl -I "https://packages.webflare.ru/_apis/public/gallery/extensionquery?api-version=7.2-preview.1"
curl -I "https://packages.webflare.ru/extensions/gallery/control"
curl -I "https://packages.webflare.ru/extensions/gallery/recommendations"
curl -I "https://packages.webflare.ru/extensions/vsix/ms-python/python/2026.4.0.vsix"
```

### 4) После обновления VS Code

Обновления VS Code могут перезаписать `product.json`.
Сделайте post-update скрипт (или task scheduler/launchd/systemd), который повторно применяет patch.

### 5) Fallback

Если у конкретной сборки official VS Code встроенный marketplace flow всё еще ограничен, используйте установку через VSIX из вашего proxy.


