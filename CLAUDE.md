# plainfare — Project Context for Claude Code

## What This Project Is

A markdown-first recipe management tool. The core philosophy is that `.md` files
**are** the database — not an export format, not a sync target, not a
convenience feature. Every part of the system reads from and writes to `.md`
files directly, in the same way that plaintext accounting tools like hledger or
beancount treat `.journal` files as the source of truth.

Users may interact with recipes entirely outside this app — editing in Obsidian,
syncing via iCloud, version controlling with git — and the app must respect
that. If this project disappeared tomorrow, the user's recipe files remain fully
intact and usable.

---

## Architecture Overview

plainfare is a pnpm monorepo with three packages:

- **`@plainfare/core`** — Pure TypeScript library. Types, ingestion pipeline,
  functions (serialise, scale). No runtime dependencies on Node-specific APIs
  like Playwright. All other packages depend on this.
- **`@plainfare/cli`** — Thin CLI over core. Single `plainfare ingest` command.
- **`@plainfare/web`** — Long-running web service. Hono server + tRPC API + React
  SPA. Owns Playwright, job queue, AI provider, and file-watching library.

The service evolution path is: **homelab** → **self-hosted** → **SaaS**.

---

## Tech Stack

- **Language**: TypeScript throughout
- **Monorepo**: pnpm workspaces
- **Markdown parsing**: `remark` / `unified` / `unist-util-visit`
- **HTML parsing**: `linkedom` (for JSON-LD extraction and HTML-to-markdown)
- **CLI**: `commander`
- **Server**: Hono + `@hono/node-server`
- **API**: tRPC (server + React client)
- **Frontend**: React (Vite-built SPA served by Hono)
- **Browser automation**: Playwright (web package only, bundled in Docker)
- **File watching**: chokidar
- **Config validation**: zod
- **Testing**: Vitest (132 tests across core, fixture-based integration tests)
- **Deployment**: Docker (multi-stage build with Chromium)

---

## Project Structure

```
/
├── packages/
│   ├── core/                      # Pure library — no side effects
│   │   ├── src/
│   │   │   ├── types.ts           # Canonical Recipe types, ConfidenceReport
│   │   │   ├── index.ts           # Public API barrel exports
│   │   │   ├── ingest/            # All routes to produce a Recipe AST
│   │   │   │   ├── markdown.ts    # parseRecipe() — remark AST → Recipe
│   │   │   │   ├── ingredient.ts  # parseIngredientLine() — "200g flour" → Ingredient
│   │   │   │   ├── confidence.ts  # buildConfidenceReport()
│   │   │   │   ├── url.ts         # ingestFromUrl() — fetch → JSON-LD or HTML fallback
│   │   │   │   ├── jsonld.ts      # extractFromJsonLd() — schema.org Recipe extraction
│   │   │   │   ├── html-to-markdown.ts  # htmlToMarkdown() — DOM → markdown
│   │   │   │   └── ai.ts          # AiProvider interface, prompt builder, response parser
│   │   │   └── functions/         # Operations on a Recipe AST
│   │   │       ├── serialise.ts   # serialiseRecipe() — Recipe → canonical markdown
│   │   │       └── scale.ts       # scaleRecipe() — adjust quantities by ratio
│   │   └── test/                  # 132 tests, fixture-based integration suite
│   │
│   ├── cli/                       # Thin CLI wrapper
│   │   └── src/
│   │       ├── index.ts           # Entry point — `plainfare` command
│   │       └── commands/
│   │           ├── ingest.ts      # plainfare ingest <file-or-url>
│   │           └── scale.ts       # plainfare scale <file> <servings>
│   │
│   └── web/                       # Long-running service
│       ├── src/
│       │   ├── server/
│       │   │   ├── index.ts       # Hono app, tRPC mount, SPA serving, graceful shutdown
│       │   │   ├── config.ts      # zod-validated env vars (PLAINFARE_RECIPES_DIR, PLAINFARE_AI_*, etc.)
│       │   │   ├── trpc.ts        # tRPC init + AppContext
│       │   │   ├── router.ts      # Root router combining all routes
│       │   │   ├── routes/
│       │   │   │   ├── recipes.ts # recipes.list, recipes.get
│       │   │   │   ├── ingest.ts  # ingest.fromImage, ingest.fromUrl
│       │   │   │   └── jobs.ts    # jobs.get, jobs.list
│       │   │   ├── services/
│       │   │   │   ├── library.ts # RecipeLibrary — scan, watch, index, search
│       │   │   │   ├── ai.ts      # OpenAiCompatibleProvider (vision API)
│       │   │   │   └── browser.ts # Playwright fetchWithBrowser + closeBrowser
│       │   │   └── jobs/
│       │   │       ├── queue.ts   # In-process job queue with concurrency control
│       │   │       ├── ai-ingest.ts     # Image → LLM → Recipe job
│       │   │       └── browser-fetch.ts # URL → browser → parse job
│       │   └── ui/
│       │       ├── main.tsx       # React entry, tRPC provider, routing
│       │       ├── lib/trpc.ts    # tRPC React client
│       │       └── pages/
│       │           ├── RecipeList.tsx    # Grid view with search
│       │           └── RecipeDetail.tsx  # Full recipe view
│       ├── Dockerfile             # Multi-stage: build monorepo → slim + Chromium
│       └── vite.config.ts
│
├── recipes/                       # Test recipes directory
├── docker-compose.yml
├── pnpm-workspace.yaml
└── CLAUDE.md                      # This file
```

---

## The Canonical Recipe Format

Every recipe file produced by plainfare follows this format. It is designed to be
human-readable as a plain document — no YAML frontmatter, no machine cruft.

```markdown
# Spaghetti Carbonara

A classic Roman pasta dish. Rich, creamy, and made without any cream.

![Spaghetti Carbonara](spaghetti-carbonara.jpg)

Source: https://example.com/carbonara
Tags: pasta, italian, weeknight
Serves: 4
Time: 10 mins prep | 20 mins cook
Calories: 520 | Protein: 22g | Carbs: 61g | Fat: 18g | Fibre: 2g

## Ingredients

### Pasta

- 200g spaghetti

### Sauce

- 4 egg yolks
- 100g guanciale
- 50g pecorino romano, finely grated
- Black pepper, to taste

## Method

1. Bring a large pot of salted water to the boil and cook the spaghetti until al
   dente.

2. Meanwhile, fry the guanciale in a dry pan over medium heat until crispy.

## Notes

Guanciale can be substituted with pancetta in a pinch.
```

### Format Rules

- **Title**: H1, always first line. Only required field.
- **Description**: Optional paragraph after the title.
- **Image**: Optional `![alt](filename.jpg)` before metadata.
- **Metadata**: Key-value lines. Known keys: `Source`, `Tags`, `Serves`, `Time`,
  `Calories`. Pipe-delimited for multi-value (Time, nutrition).
- **Ingredients**: Under `## Ingredients`. Optional `###` subgroups. List items.
- **Method**: Under `## Method`. Numbered list. Multi-paragraph steps supported.
- **Notes**: Under `## Notes`. Freeform prose.
- All fields degrade gracefully — a file with just a title is valid.

---

## Core Concepts

### Ingestion Pipeline

All ingestion routes produce a `ParseResult` containing a `Recipe` AST and a
`ConfidenceReport`. The principle is **deterministic first, LLM fallback if
confidence is low**.

**Implemented ingestion sources:**

1. **Markdown files** — canonical or wild/unformatted. Two-phase pipeline:
   remark AST parse → semantic extraction. Handles alternate section names,
   bold pseudo-headings, preamble text, metadata splitting.
2. **URLs** — JSON-LD `schema.org/Recipe` extraction first, HTML-to-markdown
   fallback. Optional browser fetch via Playwright for JS-rendered pages.
3. **Images / PDFs** — via `AiProvider` interface (OpenAI-compatible vision API).
   Prompt and response parsing live in core; actual API calls in web service.

**Planned ingestion sources:**

4. **Video** (YouTube, TikTok) — `yt-dlp` + transcription + LLM extraction
5. **Plain text / freeform** — direct LLM extraction

### Confidence Reporting

Every parsed field is tagged as `resolved` (deterministic), `inferred`
(heuristic/LLM), or `missing`. `overallConfidence` is the ratio of resolved
fields. `usedLLMFallback` tracks whether AI was involved.

### Recipe Functions

Operations on an existing `Recipe` AST:

- **`serialiseRecipe()`** — deterministic serialisation to canonical markdown
- **`scaleRecipe()`** — adjust quantities by ratio. When no `serves` field
  exists, tracks cumulative multiplier via a `Scaled: Nx from original` note.

---

## Web Service Architecture

### RecipeLibrary

In-memory `Map<string, RecipeEntry>` backed by the filesystem. On startup, scans
`PLAINFARE_RECIPES_DIR` recursively for `.md` files and parses each. chokidar watches
for external changes (add/change/delete). Own writes are debounced to avoid
redundant re-parsing.

### Job Queue

In-process `JobQueue` with configurable concurrency (default 2). EventEmitter-
based progress reporting. Swap-ready interface for BullMQ when scaling is needed.

Job types: `ai-ingest` (image → LLM → recipe), `url-ingest` (URL → fetch →
parse → recipe).

### Configuration

Environment variables validated with zod:

| Variable | Default | Description |
|---|---|---|
| `PLAINFARE_RECIPES_DIR` | `./recipes` | Path to recipe `.md` files |
| `PLAINFARE_PORT` | `3141` | Server port |
| `PLAINFARE_AI_ENDPOINT` | — | OpenAI-compatible API base URL |
| `PLAINFARE_AI_API_KEY` | — | API key for AI provider |
| `PLAINFARE_AI_MODEL` | `gpt-4o` | Model name for vision extraction |
| `PLAINFARE_JOB_CONCURRENCY` | `2` | Max concurrent background jobs |
| `PLAINFARE_BASE_URL` | — | Public-facing URL (used in Telegram replies, etc.) |
| `PLAINFARE_TELEGRAM_BOT_TOKEN` | — | Telegram bot token (enables mobile ingestion) |

### Docker Deployment

Multi-stage Dockerfile in `packages/web/`. Builds monorepo, bundles Playwright
Chromium. `docker-compose.yml` at root for easy self-hosting with volume-mounted
recipes directory.

---

## Testing

Fixture-based integration testing is the primary pattern. Input markdown files
are parsed, serialised, and compared against expected output files.

```
packages/core/test/fixtures/
  input/       # Source markdown (canonical, wild, edge cases)
  expected/    # Expected serialised output
  actual/      # Generated during test runs (gitignored)
```

Run tests:

```bash
pnpm --filter @plainfare/core test        # 132 tests
pnpm --filter @plainfare/web test         # Job queue tests
```

---

## Key Principles

1. **The `.md` file is always the source of truth.** Nothing stores recipe data
   anywhere else.
2. **Deterministic first, LLM fallback second.** Never call an LLM if a
   deterministic approach works. Track which path was taken in
   `ConfidenceReport`.
3. **Files survive without the app.** Any `.md` file produced by this system
   must be fully readable and useful as a plain document.
4. **No silent data loss.** If the parser can't resolve a field, it says so.
5. **Core stays pure.** `@plainfare/core` has no side effects, no Playwright, no
   network calls. Side-effectful concerns (browser, AI API calls, file watching)
   live in `@plainfare/web`.
6. **Pluggable external services.** AI providers, transcription, headless
   browsers — all configurable, none bundled as hard dependencies in core.

---

## What's Next

Features and improvements to build from here:

### Ingestion
- Video ingestion (yt-dlp + transcription + LLM)
- Plain text / freeform LLM extraction
- Batch ingestion (directory of files, list of URLs)
- Import from popular recipe apps (Paprika, CopyMeThat exports)

### Functions
- Unit conversion (metric ↔ imperial)
- Nutrition estimation
- Recipe deduplication / merge

### Web Service
- Real-time job progress via SSE/WebSocket
- Recipe editing in the UI
- Image upload UI for AI ingestion
- URL paste-to-ingest UI
- Recipe tagging and organisation
- Full-text search (beyond simple string matching)
- Authentication and multi-user support

### Infrastructure
- BullMQ / Redis for production job queue
- S3/object storage for recipe images
- CI/CD pipeline
- Published npm packages
