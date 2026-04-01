# plainfare — Next Steps

A prioritised roadmap based on the current state of the codebase (April 2025).
Grouped into tiers by impact and dependency order.

---

## Tier 1 — Quick wins and polish

Small improvements that make the existing feature set more robust.

### Slug collision handling
`RecipeLibrary.add()` silently overwrites if two recipes slugify to the same
name. Add a numeric suffix (`-2`, `-3`) when a slug already exists. Affects
`services/library.ts`.

### Image upload size limit
No validation on base64 image size in the ingest route. Add a zod
`.max()` on the image field and a matching check in the `ImageIngestForm`
component to fail fast with a clear message.

### Recipe scaling in the web UI
`scaleRecipe()` exists in core and works from the CLI, but the web UI has no
way to trigger it. Add a servings input on `RecipeDetail` that calls a new
`recipes.scale` tRPC mutation (or a client-side call to the pure function).

### CLI `scale` command
The project structure in CLAUDE.md lists `commands/scale.ts` but it isn't
implemented. Wire up the existing `scaleRecipe()` function as
`plainfare scale <file> <servings>`.

---

## Tier 2 — UI editing and recipe lifecycle

The web UI is currently read-only. These features close the loop so users can
manage recipes without leaving the browser.

### Recipe editing
Add an edit mode to `RecipeDetail` — a markdown textarea that saves back to
disk via a new `recipes.update` tRPC mutation. Keep it simple: edit the raw
markdown, re-parse on save, write the file. No rich editor needed initially.

### Recipe deletion
Add a `recipes.delete` mutation that removes the `.md` file and the in-memory
index entry. Confirm in the UI before deleting.

### Tag management / filtering in the UI
The API already supports `tags` filtering. Expose it in the UI: clickable tag
pills on recipe cards that filter the list, plus a tag sidebar or filter bar.

---

## Tier 3 — Ingestion expansion

New sources that bring recipes into plainfare from more places.

### Batch URL ingestion
Accept a list of URLs (newline-separated textarea or file upload) and enqueue
one job per URL. Show aggregate progress. Useful for migrating a bookmarks
folder.

### RecipeMD and Cooklang ingestion
The markdown parser already handles wild formats well. Add explicit support for:
- **RecipeMD** conventions (italic amounts, bold yields, `---` separators,
  italic tags) — mostly parser tolerance work
- **Cooklang `.cook` files** — dedicated parser for inline ingredient syntax
  (`@flour{200%g}`) and YAML metadata headers

Both produce a standard `Recipe` AST and serialise to plainfare's canonical
format.

### Paprika / CopyMeThat import
These export as `.paprikarecipes` (gzipped SQLite) or HTML. Parse the export
format, extract recipes, run through the standard pipeline. Covers the most
common migration path for users switching from other apps.

### Video ingestion
YouTube / TikTok / Instagram Reels. Pipeline:
1. `yt-dlp` to download or extract audio
2. Whisper (or similar) transcription
3. LLM extraction from transcript → Recipe AST

Heaviest lift in the list. Worth prototyping the transcript → LLM → Recipe
path first using a pasted transcript before wiring up yt-dlp.

---

## Tier 4 — Recipe intelligence

Operations on the recipe collection that go beyond storage.

### Unit conversion (metric ↔ imperial)
A `convertUnits()` function in core that rewrites ingredient quantities.
Expose as a toggle in the UI and a CLI flag. Needs a unit mapping table and
sensible rounding rules (don't say "236.588ml" for "1 cup").

### Shopping list generation
Aggregate ingredients across selected recipes, merge duplicates (sum
quantities for the same ingredient+unit), output as markdown checklist.
Natural fit for the CLI (`plainfare shop recipe1.md recipe2.md`) and a UI
page.

### Recipe deduplication
Detect near-duplicate recipes by title similarity and ingredient overlap.
Surface candidates in the UI for manual merge. Useful after bulk imports.

### Nutrition estimation
When nutrition data is missing, estimate from ingredients using a food
composition database (USDA FoodData Central API or a local SQLite copy).
Mark estimated values as `inferred` in the confidence report.

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
