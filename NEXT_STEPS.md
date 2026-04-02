# plainfare — Next Steps

A prioritised roadmap based on the current state of the codebase (April 2025).
Grouped into tiers by impact and dependency order.

---

## Tier 1 — Quick wins and polish ✓

- ~~Slug collision handling~~ — numeric suffix (`-2`, `-3`) on duplicates
- ~~Image upload size limit~~ — 10MB zod validation server-side, client already had it
- ~~Recipe scaling in the web UI~~ — client-side scaling via +/- servings adjuster
  and 1x–5x multiplier for recipes without serves
- ~~Recipe image display~~ — hero image on detail page, thumbnail on cards
- ~~CLI `scale` command~~ — removed; scaling is view-only to avoid persisting
  incomplete scaling (method text amounts aren't scaled)

---

## Tier 2 — UI editing and recipe lifecycle ✓

- ~~Recipe editing~~ — markdown textarea edit mode on detail page
- ~~Recipe deletion~~ — with two-step confirmation, navigates home after
- ~~Tag filtering~~ — clickable tag pills in filter bar and on cards, counts
  shown, sorted by popularity, card tags truncated to 3 with +N overflow

---

## Tier 3 — Ingestion expansion ✓

- ~~Batch URL ingestion~~ — "Batch URLs" tab, one URL per line, per-job
  progress rows with hostname, progress bar, done/failed status
- ~~RecipeMD support~~ — italic tags, bold yields, `---` section separators
- ~~Cooklang `.cook` files~~ — dedicated parser, CLI auto-detects `.cook` extension
- ~~Paprika / CopyMeThat import~~ — Paprika `.paprikarecipes` (zip of gzipped
  JSON) and CopyMeThat `.zip` (HTML) parsers in core, "Import" tab in ingest
  UI, CLI auto-detects archive extensions
- ~~Video ingestion (Phase A)~~ — yt-dlp subtitle extraction + LLM recipe
  extraction. "From Video" tab in ingest UI (gated on AI + yt-dlp). Docker
  images include yt-dlp. Phase B (audio transcription) deferred.

---

## Tier 4 — Recipe intelligence ✓

- ~~Unit conversion~~ — `convertUnits()` in core with metric/imperial
  conversion tables, sensible rounding (nearest quarter for small values,
  nearest 5 for large). Original/Metric/Imperial toggle on ingredient section.
- ~~Shopping list~~ — `generateShoppingList()` merges ingredients across
  selected recipes by name+unit, sums quantities. UI page at `/shopping` with
  recipe checkboxes, clickable checklist, copy-to-clipboard. Header nav link.
- ~~Recipe deduplication~~ — Levenshtein title similarity + Jaccard ingredient
  overlap. `/duplicates` page shows candidates with "Keep Left/Right" actions.
- ~~Nutrition estimation~~ — LLM-based estimation from ingredients via existing
  AI provider. "Estimate nutrition" button on recipe detail page when AI is
  configured and no nutrition data exists. Results saved to the recipe file.

---

## Tier 5 — Infrastructure and scaling

For when plainfare outgrows a single-user homelab.

### Persistent job queue (BullMQ + Redis)
Replace the in-process queue with BullMQ. Jobs survive restarts, support
retries, and enable horizontal scaling. The current `JobQueue` interface is
already designed for this swap.

### Real-time job progress (SSE or WebSocket)
Replace polling in `useJobPolling` with server-sent events. Reduces
unnecessary requests and gives instant feedback.

### Full-text search
Replace the substring matching in `RecipeLibrary.list()` with a proper search
index — SQLite FTS5 or MeiliSearch. Supports stemming, fuzzy matching, and
ranked results. Important once collections grow past a few hundred recipes.

### Authentication and multi-user
Add auth (probably OAuth2 / OIDC via an external provider) and per-user
recipe directories. Necessary before any hosted/SaaS deployment.

### CI/CD
GitHub Actions: lint, typecheck, test on every PR. Docker image build and
push on merge to main. Publish npm packages if core becomes useful
standalone.

---

## Not planned (and why)

- **Custom markdown syntax** — plainfare's differentiator is that files are
  plain markdown. No `@ingredient{qty}` annotations. If a feature needs
  machine markup, derive it at parse time.
- **Database backend** — `.md` files are the database. This is the core
  philosophy, not a limitation to fix.
- **Mobile app** — Telegram bot covers mobile ingestion. For reading, the
  web UI works on mobile browsers. A native app adds maintenance burden
  without enough upside yet.
