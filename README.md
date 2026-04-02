# plainfare

A markdown-first recipe management tool. Your `.md` files **are** the database — not an export format, not a sync target. Edit recipes in Obsidian, sync with iCloud, version control with git. If plainfare disappeared tomorrow, your recipe files remain fully intact and usable.

## Features

- **Markdown is the database** — every recipe is a readable `.md` file, no proprietary formats
- **Multiple ingestion sources** — URLs (with JSON-LD extraction), images, text, video (YouTube/TikTok/Instagram), Paprika and CopyMeThat imports
- **AI-powered extraction** — point any OpenAI-compatible API (OpenAI, Ollama, etc.) at a photo or video and get a structured recipe
- **Recipe scaling** — adjust servings with automatic ingredient recalculation
- **Unit conversion** — toggle between original, metric, and imperial
- **Shopping lists** — select recipes, get a merged ingredient list with quantities summed
- **Nutrition estimation** — AI-powered per-serving nutrition from ingredients
- **Duplicate detection** — finds near-duplicate recipes by title and ingredient similarity
- **Telegram bot** — send a URL, photo, or text to your bot and it saves the recipe
- **File watching** — edit recipes externally, the app picks up changes instantly
- **Self-hosted** — Docker image with optional Chromium for JS-rendered recipe sites

## Recipe Format

```markdown
# Spaghetti Carbonara

A classic Roman pasta dish.

Source: https://example.com/carbonara
Tags: pasta, italian, weeknight
Serves: 4
Time: 10 mins prep | 20 mins cook
Calories: 520 | Protein: 22g | Carbs: 61g | Fat: 18g | Fibre: 2g

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
      # Optional: enable AI features
      # PLAINFARE_AI_ENDPOINT: https://api.openai.com
      # PLAINFARE_AI_API_KEY: sk-...
      # PLAINFARE_AI_MODEL: gpt-4o
    restart: unless-stopped
```

For Chromium-based URL fetching (JS-rendered recipe sites):

```bash
docker run -d \
  -p 3141:3141 \
  -v ./recipes:/data/recipes \
  ghcr.io/ptimoney/plainfare:latest-chromium
```

See [DEPLOY.md](DEPLOY.md) for full configuration, reverse proxy examples, and non-Docker setup.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PLAINFARE_RECIPES_DIR` | `./recipes` | Path to recipe `.md` files |
| `PLAINFARE_PORT` | `3141` | Server port |
| `PLAINFARE_AI_ENDPOINT` | — | OpenAI-compatible API base URL |
| `PLAINFARE_AI_API_KEY` | — | API key for AI provider |
| `PLAINFARE_AI_MODEL` | `gpt-4o` | Model name |
| `PLAINFARE_TELEGRAM_BOT_TOKEN` | — | Telegram bot token |
| `PLAINFARE_BASE_URL` | — | Public URL (for Telegram reply links) |
| `PLAINFARE_JOB_CONCURRENCY` | `2` | Max concurrent background jobs |

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
```

### Project Structure

- `packages/core` — Pure TypeScript library: types, parsing, serialisation, scaling
- `packages/web` — Hono server + React SPA + job queue + AI/browser/Telegram services
- `packages/cli` — Thin CLI wrapper over core

## License

[MIT](LICENSE)
