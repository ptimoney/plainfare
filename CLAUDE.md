# Recipe MD — Project Context for Claude Code

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

This is inspired by the Plain Text Accounting (PTA) movement applied to recipe
management.

---

## Build Approach

Start simple, build incrementally. The project stages are:

1. **Core library** — TypeScript types, markdown parser (read/write), ingredient
   parser, scaling, unit conversion
2. **CLI** — thin commands over the core library
3. **Web app** — Next.js frontend reading from the same `.md` files via the same
   core library
4. **Hosted/SaaS** — future consideration

At every stage, the `.md` file is the source of truth. Nothing bypasses the core
library to read recipe data directly.

---

## Tech Stack

- **Language**: TypeScript throughout
- **Markdown parsing**: `remark` / `unified` ecosystem for AST-based parsing
- **CLI**: `commander` or `oclif`
- **Web app** (later): Next.js
- **API layer** (later): tRPC
- **Testing**: Vitest
- **Package manager**: pnpm

---

## The Canonical Recipe Format

This is what every recipe file should look like after ingestion or
normalisation. It is designed to be human-readable as a plain document — no YAML
frontmatter, no machine cruft.

```markdown
# Spaghetti Carbonara

A classic Roman pasta dish. Rich, creamy, and made without any cream.

![Spaghetti Carbonara](spaghetti-carbonara.jpg)

Source: https://example.com/carbonara Tags: pasta, italian, weeknight Serves: 4
Time: 10 mins prep | 20 mins cook Calories: 520 | Protein: 22g | Carbs: 61g |
Fat: 18g | Fibre: 2g

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

2. Meanwhile, fry the guanciale in a dry pan over medium heat until crispy. You
   want good colour and rendered fat, which will form part of the sauce.

3. Whisk the egg yolks with the pecorino and a generous amount of black pepper.
   The mixture should be thick and pale.

4. Reserve a cup of pasta water before draining.

5. Remove the pan from heat, add the drained pasta to the guanciale, then
   quickly add the egg mixture, tossing vigorously and adding pasta water to
   loosen. Work quickly — residual heat only, or the eggs will scramble.

## Notes

Guanciale can be substituted with pancetta in a pinch, though the flavour is
noticeably different. Never use cream.
```

### Format Rules

- **Title**: H1, always first line
- **Description**: Optional short paragraph immediately after the title
- **Image**: Optional `![alt](filename.jpg)` — local file path, image sits
  alongside the `.md` file (e.g. in an `attachments/` subfolder or same
  directory)
- **Metadata block**: Key-value lines after the description/image. Known keys:
  `Source`, `Tags`, `Serves`, `Time`, `Calories`. Pipe-delimited for multi-value
  fields (Time, nutrition).
- **Time**: `Time: Xmins prep | Y mins cook` — total is always derived (prep +
  cook), never stored explicitly
- **Nutrition**: `Calories: N | Protein: Ng | Carbs: Ng | Fat: Ng | Fibre: Ng` —
  all fields optional, partial nutrition is valid
- **Tags**: Comma-separated inline on a single line
- **Ingredients**: Under `## Ingredients`. Optional `###` subsections for
  grouped ingredients (e.g. `### Sauce`, `### Dough`). Each ingredient is a list
  item.
- **Method**: Under `## Method`. Numbered list. Steps may be multi-paragraph —
  blank line between items with continuation lines indented.
- **Notes**: Under `## Notes`. Always freeform prose. No structure enforced.
- **Only `#` title is required** — all other fields degrade gracefully. A file
  with just a title, ingredients, and method is valid.

---

## TypeScript Types

These are the canonical in-memory types the core library works with. All parser
output and writer input should conform to these.

```typescript
export interface RecipeTime {
  prep?: number; // minutes
  cook?: number; // minutes
}

export interface Nutrition {
  calories?: number;
  protein?: number; // grams
  carbs?: number; // grams
  fat?: number; // grams
  fibre?: number; // grams
}

export interface Ingredient {
  quantity?: number;
  unit?: string;
  name: string;
  note?: string; // e.g. "finely grated", "to taste"
}

export interface IngredientGroup {
  title?: string; // undefined = ungrouped
  ingredients: Ingredient[];
}

export interface MethodStep {
  number: number;
  paragraphs: string[]; // multi-paragraph steps supported
}

export interface Recipe {
  title: string;
  description?: string;
  image?: string; // local file path or URL
  source?: string; // URL or attribution string
  tags?: string[];
  serves?: string; // kept as string: "4", "12 cookies", "6-8"
  time?: RecipeTime;
  nutrition?: Nutrition;
  ingredientGroups: IngredientGroup[];
  steps: MethodStep[];
  notes?: string;
}

export type ConfidenceLevel = "resolved" | "inferred" | "missing";

export interface ConfidenceReport {
  fields: Partial<Record<keyof Recipe, ConfidenceLevel>>;
  overallConfidence: number; // 0-1
  usedLLMFallback: boolean;
}

export interface ParseResult {
  recipe: Recipe;
  confidence: ConfidenceReport;
}
```

---

## Parser Architecture

The parser has two distinct responsibilities:

### Reader (`parseRecipe(markdown: string): ParseResult`)

A two-phase pipeline:

**Phase 1 — Structural parse** Use `remark`/`unified` to parse the markdown into
an AST. This is always deterministic. Identify headings, lists, paragraphs, and
their hierarchy.

**Phase 2 — Semantic extraction** Walk the AST and map nodes to recipe fields:

- Title: first `h1`
- Description: first paragraph before any metadata keys or headings
- Image: `![...]()` node before the metadata block
- Metadata: paragraphs containing `Key: value` or `Key: value | value` patterns
  — scan for known keys only
- Ingredients: list nodes under the `## Ingredients` heading; `###` subheadings
  become group titles
- Method steps: ordered list under `## Method`; collect consecutive paragraphs
  per item for multi-paragraph steps
- Notes: all content under `## Notes` as freeform text

Each field that resolves cleanly is marked `resolved` in the confidence report.
Fields that required heuristic guessing are marked `inferred`. Fields not found
are `missing`.

**LLM fallback** If `overallConfidence` falls below a configurable threshold
(default `0.7`), or specific critical fields (`ingredientGroups`, `steps`) are
`missing`, pass the raw markdown to an LLM with a structured extraction prompt.
Merge LLM results for unresolved fields only. Mark fallback fields as `inferred`
and set `usedLLMFallback: true`.

### Writer (`serialiseRecipe(recipe: Recipe): string`)

Deterministic serialisation from a `Recipe` object to canonical markdown. Always
produces the canonical format. No fallback needed.

### Ingredient Line Parser (`parseIngredientLine(line: string): Ingredient`)

A sub-module within the reader. Handles the wide variety of ingredient line
formats:

- `200g spaghetti`
- `2 cups flour, sifted`
- `4 egg yolks`
- `a handful of parsley`
- `Black pepper, to taste`

Pattern: try regex-based quantity/unit/name extraction first. If ambiguous (no
recognisable quantity or unit), fall back to treating the full string as the
`name` with no quantity. LLM fallback available for genuinely ambiguous lines if
enabled.

---

## Ingestion Pipeline

All ingestion routes produce a canonical `.md` file. The principle across all
routes is **deterministic first, LLM fallback if confidence is low**. This
applies both for cost/speed reasons and to keep the system predictable.

### Ingestion Sources (in order of implementation priority)

1. **Fuzzy `.md` files** — existing markdown that doesn't match canonical
   format. Parse and normalise. First source to implement as it validates the
   whole parser pipeline. Option to replace-in-place, replace-with-backup,
   write-to-output-dir, or dry-run.
2. **URLs** — fetch page content, attempt structured data extraction (JSON-LD
   `Recipe` schema first), fall back to headless browser + LLM if needed.
3. **Images / PDFs** — pass to LLM vision API for extraction
4. **Video (YouTube, TikTok, Instagram)** — download via `yt-dlp`, transcribe
   via pluggable transcription service (Whisper or compatible), extract recipe
   from transcript via LLM
5. **Plain text / freeform** — pass directly to LLM extraction

### Pluggable External Services

Users can configure external services in a config file. The system calls out to
these rather than bundling them:

- AI provider (OpenAI-compatible endpoint, API key, model)
- Transcription provider (Whisper-compatible endpoint)
- Headless browser endpoint (Playwright/Puppeteer remote)

---

## CLI Commands (Initial Targets)

```
recipe parse <file.md>                    # Parse and report confidence, output canonical md to stdout
recipe normalise <file.md> [options]      # Normalise a fuzzy .md file to canonical format
  --replace                               # Replace in place
  --backup                                # Replace with .orig backup
  --output <dir>                          # Write to output directory
  --dry-run                               # Show diff without writing

recipe ingest url <url>                   # Ingest from URL, write .md file
recipe ingest image <file>                # Ingest from image or PDF
recipe ingest video <url>                 # Ingest from video URL

recipe scale <file.md> <servings>         # Output scaled recipe
recipe convert <file.md> --to <metric|imperial>  # Unit conversion
```

---

## Project Structure (Initial)

```
/
├── packages/
│   └── core/                  # Core library — types, parser, writer, ingredient parser
│       ├── src/
│       │   ├── types.ts
│       │   ├── parser/
│       │   │   ├── reader.ts
│       │   │   ├── writer.ts
│       │   │   ├── ingredient.ts
│       │   │   └── confidence.ts
│       │   └── index.ts
│       └── package.json
├── packages/
│   └── cli/                   # CLI — thin commands over core
│       ├── src/
│       │   └── index.ts
│       └── package.json
├── pnpm-workspace.yaml
└── CLAUDE.md                  # This file
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
   Dry-run and backup modes exist to prevent accidental overwrites.
5. **Pluggable external services.** AI providers, transcription, headless
   browsers — all configurable, none bundled as hard dependencies.
6. **Incremental delivery.** Each stage (core library → CLI → web app) should be
   independently useful.

---

## Where to Start

1. Scaffold the monorepo with pnpm workspaces
2. Create `packages/core` with the TypeScript types in `types.ts`
3. Implement the **writer** first (`serialiseRecipe`) — it's simple and gives
   you the canonical format as executable code
4. Implement the **reader** (`parseRecipe`) against the writer's output — use
   the writer's output as your first test fixture
5. Implement the **ingredient line parser** as a standalone tested module
6. Wire up the **CLI** with `recipe parse` and `recipe normalise` as the first
   two commands
7. Add the **URL ingestion** route once the parse/normalise pipeline is solid
