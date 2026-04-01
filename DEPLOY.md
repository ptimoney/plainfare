# Deploying mise

## Quick start (Docker Compose)

```bash
# 1. Clone and configure
git clone <repo-url> mise && cd mise
cp .env.example .env
# Edit .env with your settings (see Configuration below)

# 2. Run
docker compose up -d

# 3. Open http://localhost:3000
```

That's it. Recipes are stored in `./recipes/` as plain markdown files.

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` to
get started — only the defaults run out of the box, everything else is opt-in.

| Variable | Default | Description |
|---|---|---|
| `MISE_PORT` | `3000` | Server port |
| `MISE_BASE_URL` | — | Public URL (e.g. `https://mise.example.com`). Used in Telegram replies and anywhere the app needs to link back to itself. |
| `MISE_RECIPES_DIR` | `./recipes` | Host path to recipe files (mapped to `/data/recipes` in container) |
| `MISE_AI_ENDPOINT` | — | OpenAI-compatible API URL (e.g. `https://api.openai.com`, `http://ollama:11434`) |
| `MISE_AI_API_KEY` | — | API key for the AI provider |
| `MISE_AI_MODEL` | `gpt-4o` | Model name for AI extraction |
| `MISE_TELEGRAM_BOT_TOKEN` | — | Telegram bot token for mobile ingestion |
| `MISE_JOB_CONCURRENCY` | `2` | Max concurrent background jobs |

### Minimal (no AI, no Telegram)

```env
# .env
MISE_BASE_URL=https://mise.example.com
```

URL ingestion (JSON-LD / HTML parsing) works without AI. You can paste recipe
URLs in the web UI and they'll be extracted deterministically.

### With AI extraction

```env
# .env — using OpenAI
MISE_BASE_URL=https://mise.example.com
MISE_AI_ENDPOINT=https://api.openai.com
MISE_AI_API_KEY=sk-...
MISE_AI_MODEL=gpt-4o
```

```env
# .env — using local Ollama
MISE_BASE_URL=https://mise.example.com
MISE_AI_ENDPOINT=http://host.docker.internal:11434
MISE_AI_MODEL=gemma3:12b
```

Enables text and image extraction (paste text, upload photos, etc).

### With Telegram bot

```env
# .env
MISE_BASE_URL=https://mise.example.com
MISE_TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
MISE_AI_ENDPOINT=https://api.openai.com
MISE_AI_API_KEY=sk-...
```

To create a bot:
1. Open Telegram, message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`, pick a name and username
3. Copy the token into `MISE_TELEGRAM_BOT_TOKEN`

Then share URLs, text, or photos with your bot from any device.

---

## Reverse proxy

mise should sit behind a reverse proxy (Nginx, Caddy, Traefik, etc.) for TLS
and public access.

### Nginx / Nginx Proxy Manager

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

If using Nginx Proxy Manager, add this in the **Advanced** tab for the proxy
host (no `location` block — NPM wraps it for you):

```
proxy_read_timeout 150s;
proxy_send_timeout 150s;
```

The extended timeout is needed if AI extraction goes through a slow model (e.g.
local Ollama).

### Caddy

```
mise.example.com {
    reverse_proxy localhost:3000
}
```

Caddy handles TLS automatically.

---

## Browser-based URL fetching (optional)

The default image does **not** include Chromium. Most recipe sites serve
JSON-LD metadata that mise extracts without a browser.

If you need browser rendering for JavaScript-heavy sites, use the Chromium
variant:

```yaml
# docker-compose.yml
services:
  mise:
    build:
      context: .
      dockerfile: packages/web/Dockerfile.chromium
    # ... rest unchanged
```

This adds ~400MB to the image for Playwright + Chromium.

---

## Volumes and data

Recipes are plain `.md` files in the recipes directory. The container mounts
this as a volume:

```yaml
volumes:
  - ./recipes:/data/recipes
```

You can:
- Edit recipes with any text editor, Obsidian, VS Code, etc.
- Sync them via git, iCloud, Syncthing, or any file sync tool
- Back them up by copying the directory

There is no database. If you delete the container, your recipes are still on
disk exactly where you left them.

---

## Updating

```bash
git pull
docker compose up -d --build
```

---

## Running without Docker

```bash
# Install dependencies
pnpm install

# Build
pnpm build
pnpm --filter @mise/web run build

# Set environment
export MISE_RECIPES_DIR=/path/to/recipes
export MISE_PORT=3000
# ... other env vars as needed

# Start
pnpm --filter @mise/web start
```

---

## Health check

```bash
curl http://localhost:3000/api/health
# {"status":"ok","recipes":12,"ai":true}
```

The Docker image includes a built-in health check that hits this endpoint every
30 seconds.
