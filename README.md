# plainfare

A markdown-first recipe houeshold management tool. Bringing the plain text
accounting mindset to recipes. Your `.md` files **are** the database — not an
export format, not a sync target. Edit recipes in Obsidian, or vscode or neovim,
sync with iCloud, or syncthing, or don't sync at all, version control with git
or don't. If plainfare disappeared tomorrow, your recipe files remain fully
intact and usable.

At it's core it is a recipe ingestion service which processes recipes into
human-centred, readable markdown recipe files (ie not human parseable
pseudo-code), and you can use it just like that. Point its storage at an
obsidian vault, or anywhere else you like, add the telegram app and start
sharing recipies from websites, YouTube videos, photos, etc and come back to
formatted, saved recipe markdown files. If you want you can view, edit, manage,
convert or scale the recipes in the web portal, but you don't need to. Use your
existing systems if you like

## Features

- **Markdown is the database** — every recipe is a readable `.md` file, no
  proprietary formats
- **Multiple ingestion sources** — URLs (with JSON-LD extraction), images, text,
  video (YouTube/TikTok/Instagram), Paprika and CopyMeThat imports
- **AI-powered extraction** — point any OpenAI-compatible API (OpenAI, Ollama,
  etc.) at a photo or video and get a structured recipe
- **Recipe scaling** — adjust servings with automatic ingredient recalculation
- **Unit conversion** — toggle between original, metric, and imperial
- **Shopping lists** — select recipes, get a merged ingredient list with
  quantities summed
- **Nutrition estimation** — AI-powered per-serving nutrition from ingredients
- **Duplicate detection** — finds near-duplicate recipes by title and ingredient
  similarity
- **Telegram bot** — send a URL, photo, or text to your bot and it saves the
  recipe
- **File watching** — edit recipes externally, the app picks up changes
  instantly
- **Self-hosted** — Docker image with optional Chromium for JS-rendered recipe
  sites

## Recipe Format

```markdown
# Spaghetti Carbonara

A classic Roman pasta dish.

Source: https://example.com/carbonara Tags: pasta, italian, weeknight Serves: 4
Time: 10 mins prep | 20 mins cook Calories: 520 | Protein: 22g | Carbs: 61g |
Fat: 18g | Fibre: 2g

## Ingredients

- 200g spaghetti
- 4 egg yolks
- 100g guanciale
- 50g pecorino romano, finely grated
- Black pepper, to taste

## Method

1. Bring a large pot of salted water to the boil and cook the spaghetti.
2. Fry the guanciale in a dry pan until crispy.
3. Whisk egg yolks with pecorino. Toss with hot pasta off the heat.

## Notes

Guanciale can be substituted with pancetta in a pinch.
```

All fields are optional — a file with just a title is valid.

## Quick Start

```bash
# 1. Create a directory for your recipes
mkdir recipes

# 2. Start plainfare
docker run -d \
  -p 3141:3141 \
  -v ./recipes:/data/recipes \
  ghcr.io/ptimoney/plainfare:latest

# 3. Open http://localhost:3141
```

Or with Docker Compose:

```yaml
services:
  plainfare:
    image: ghcr.io/ptimoney/plainfare:latest
    ports:
      - "3141:3141"
    volumes:
      - ./recipes:/data/recipes
    environment:
      # PLAINFARE_PORT: 3141
      # PLAINFARE_BASE_URL: https://plainfare.example.com
      # PLAINFARE_JOB_CONCURRENCY: 2
      #
      # AI provider (enables image/text/video extraction + nutrition estimation)
      # PLAINFARE_AI_ENDPOINT: https://api.openai.com
      # PLAINFARE_AI_API_KEY: sk-...
      # PLAINFARE_AI_MODEL: gpt-4o
      #
      # Telegram bot (send recipes from your phone)
      # PLAINFARE_TELEGRAM_BOT_TOKEN: "123456:ABC-DEF..."
      #
      # Authentication (both required to enable login)
      # PLAINFARE_USERNAME: admin
      # PLAINFARE_PASSWORD: changeme
    restart: unless-stopped
```

For Chromium-based URL fetching (JS-rendered recipe sites), use this image
instead: `ghcr.io/ptimoney/plainfare:latest-chromium`

## Configuration

| Variable                       | Default     | Description                            |
| ------------------------------ | ----------- | -------------------------------------- |
| `PLAINFARE_RECIPES_DIR`        | `./recipes` | Path to recipe `.md` files             |
| `PLAINFARE_PORT`               | `3141`      | Server port                            |
| `PLAINFARE_BASE_URL`           | —           | Public URL (for Telegram reply links)  |
| `PLAINFARE_AI_ENDPOINT`        | —           | OpenAI-compatible API base URL         |
| `PLAINFARE_AI_API_KEY`         | —           | API key for AI provider                |
| `PLAINFARE_AI_MODEL`           | `gpt-4o`    | Model name                             |
| `PLAINFARE_TELEGRAM_BOT_TOKEN` | —           | Telegram bot token                     |
| `PLAINFARE_JOB_CONCURRENCY`    | `2`         | Max concurrent background jobs         |
| `PLAINFARE_USERNAME`           | —           | Username for login (enables auth)      |
| `PLAINFARE_PASSWORD`           | —           | Password for login (requires username) |

URL ingestion works without AI — paste a recipe URL and it'll be extracted
deterministically via JSON-LD or HTML parsing. AI unlocks image, text, and video
extraction plus nutrition estimation.

### Telegram Bot Setup

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot`, pick a name and username
3. Set `PLAINFARE_TELEGRAM_BOT_TOKEN` to the token you receive

Then share URLs, text, photos, or video links with your bot from any device.

## Your Data

Recipes are plain `.md` files in the mounted volume. You can:

- Edit them with any text editor, Obsidian, VS Code, etc.
- Sync via git, iCloud, Syncthing, or any file sync tool
- Back up by copying the directory

There is no database. If you delete the container, your recipes are still on
disk exactly where you left them.

## Updating

```bash
docker compose pull
docker compose up -d
```

## Health Check

```bash
curl http://localhost:3141/api/health
# {"status":"ok","recipes":12,"ai":true,"ytdlp":true}
```

## CLI

```bash
# Install
pnpm --filter @plainfare/cli build
npx plainfare --help

# Ingest from various sources
plainfare ingest https://example.com/recipe
plainfare ingest recipe-photo.jpg
plainfare ingest recipe.cook
plainfare ingest export.paprikarecipes
```

## Development

```bash
# Prerequisites: Node 22+, pnpm 10+

# Install dependencies
pnpm install

# Start dev server (API + UI with hot reload)
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck

# Build from source
docker compose up -d --build
```

### Project Structure

- `packages/core` — Pure TypeScript library: types, parsing, serialisation,
  scaling
- `packages/web` — Hono server + React SPA + job queue + AI/browser/Telegram
  services
- `packages/cli` — Thin CLI wrapper over core

## License

[MIT](LICENSE)
