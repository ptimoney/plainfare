import type { ParseResult } from "../types.js";
import { parseRecipe } from "./markdown.js";
import { buildConfidenceReport } from "./confidence.js";
import { extractFromJsonLd } from "./jsonld.js";
import { htmlToMarkdown } from "./html-to-markdown.js";

export interface IngestUrlOptions {
  /** Custom fetch function (for testing or custom HTTP clients) */
  fetch?: typeof globalThis.fetch;
  /** Custom User-Agent header */
  userAgent?: string;
  /** Use headless browser for fetching (handles JS-rendered sites and bot detection) */
  useBrowser?: boolean;
  /** Custom browser fetch function (for testing) */
  browserFetch?: (url: string) => Promise<string>;
}

export interface IngestUrlResult extends ParseResult {
  /** Which extraction method succeeded */
  method: "json-ld" | "html-fallback";
  /** The source URL */
  sourceUrl: string;
  /** Whether a headless browser was used to fetch the page */
  usedBrowser: boolean;
}

/**
 * Ingest a recipe from a URL.
 *
 * Strategy:
 * 1. Fetch the page HTML (plain fetch first, browser fallback if blocked)
 * 2. Try JSON-LD structured data extraction (highest confidence)
 * 3. Fall back to HTML → markdown → parser pipeline
 */
export async function ingestFromUrl(
  url: string,
  options: IngestUrlOptions = {},
): Promise<IngestUrlResult> {
  const { html, usedBrowser } = await fetchHtml(url, options);


  return extractRecipe(html, url, usedBrowser);
}

function extractRecipe(
  html: string,
  url: string,
  usedBrowser: boolean,
): IngestUrlResult {
  // Phase 1: Try JSON-LD
  const jsonLdRecipe = extractFromJsonLd(html);
  if (jsonLdRecipe && hasValidRecipeData(jsonLdRecipe)) {
    if (!jsonLdRecipe.source) jsonLdRecipe.source = url;

    const fields: Record<string, "resolved"> = { title: "resolved" };
    if (jsonLdRecipe.description) fields.description = "resolved";
    if (jsonLdRecipe.image) fields.image = "resolved";
    if (jsonLdRecipe.source) fields.source = "resolved";
    if (jsonLdRecipe.tags) fields.tags = "resolved";
    if (jsonLdRecipe.serves) fields.serves = "resolved";
    if (jsonLdRecipe.time) fields.time = "resolved";
    if (jsonLdRecipe.nutrition) fields.nutrition = "resolved";
    if (jsonLdRecipe.ingredientGroups.length > 0) fields.ingredientGroups = "resolved";
    if (jsonLdRecipe.steps.length > 0) fields.steps = "resolved";

    return {
      recipe: jsonLdRecipe,
      confidence: buildConfidenceReport(fields, false),
      method: "json-ld",
      sourceUrl: url,
      usedBrowser,
    };
  }

  // Phase 2: HTML → Markdown → Parser
  const markdown = htmlToMarkdown(html);
  const result = parseRecipe(markdown);

  if (!result.recipe.source) result.recipe.source = url;

  return {
    ...result,
    method: "html-fallback",
    sourceUrl: url,
    usedBrowser,
  };
}

/**
 * Fetch HTML from a URL. Tries plain fetch first, falls back to headless
 * browser if the response indicates bot blocking (non-2xx status).
 */
async function fetchHtml(
  url: string,
  options: IngestUrlOptions,
): Promise<{ html: string; usedBrowser: boolean }> {
  const fetchFn = options.fetch || globalThis.fetch;
  const userAgent =
    options.userAgent ||
    "Mozilla/5.0 (compatible; MiseRecipeBot/0.1; +https://github.com/ptimoney/mise)";

  // If browser mode is explicitly requested, skip plain fetch
  if (options.useBrowser) {
    const html = await getBrowserFetch(options)(url);
    return { html, usedBrowser: true };
  }

  // Try plain fetch first
  const response = await fetchFn(url, {
    headers: {
      "User-Agent": userAgent,
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });

  if (response.ok) {
    return { html: await response.text(), usedBrowser: false };
  }

  // Non-2xx — likely bot-blocked. Try browser fallback if available.
  try {
    const html = await getBrowserFetch(options)(url);
    return { html, usedBrowser: true };
  } catch {
    // Browser fallback also failed — throw the original HTTP error
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
}

function getBrowserFetch(options: IngestUrlOptions): (url: string) => Promise<string> {
  if (options.browserFetch) return options.browserFetch;
  throw new Error("Browser fetch requested but no browserFetch function provided. Install the web service for browser support.");
}

/** A recipe must have ingredients AND steps to be considered valid */
function hasValidRecipeData(recipe: { ingredientGroups: { ingredients: unknown[] }[]; steps: unknown[] }): boolean {
  const hasIngredients = recipe.ingredientGroups.some((g) => g.ingredients.length > 0);
  const hasSteps = recipe.steps.length > 0;
  return hasIngredients && hasSteps;
}
