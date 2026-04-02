import { unzipSync } from "fflate";
import type { ParseResult, Recipe, ConfidenceLevel } from "../types.js";
import { parseIngredientLine } from "./ingredient.js";
import { buildConfidenceReport } from "./confidence.js";

/**
 * Parse a CopyMeThat `.zip` export archive.
 * Format: zip containing HTML files with recipe data.
 *
 * CopyMeThat exports are HTML files. The main export contains a single
 * HTML file with all recipes structured as recipe cards. Each recipe
 * typically has a title, ingredients list, and directions.
 */
export function parseCopyMeThatArchive(buffer: Uint8Array): ParseResult[] {
  const zipEntries = unzipSync(buffer);
  const results: ParseResult[] = [];

  for (const [filename, data] of Object.entries(zipEntries)) {
    if (!filename.endsWith(".html") && !filename.endsWith(".htm")) continue;

    try {
      const html = new TextDecoder().decode(data);
      results.push(...parseRecipesFromHtml(html));
    } catch {
      // Skip files that fail to parse
    }
  }

  return results;
}

function parseRecipesFromHtml(html: string): ParseResult[] {
  // Use a simple regex-based approach since linkedom is in the web package, not core.
  // CopyMeThat exports each recipe in a <div class="recipe"> or similar block.
  // We split on recipe boundaries and extract fields.

  const results: ParseResult[] = [];

  // Try to find recipe blocks — CopyMeThat uses various structures
  // Common pattern: <h2>Title</h2> followed by ingredients and directions sections
  const recipeBlocks = splitRecipeBlocks(html);

  for (const block of recipeBlocks) {
    const recipe = extractRecipeFromBlock(block);
    if (!recipe) continue;

    const fields: Partial<Record<keyof Recipe, ConfidenceLevel>> = {};
    fields.title = recipe.title !== "Untitled Recipe" ? "resolved" : "missing";
    fields.ingredientGroups = recipe.ingredientGroups.length > 0 ? "resolved" : "missing";
    fields.steps = recipe.steps.length > 0 ? "resolved" : "missing";
    fields.description = recipe.description ? "resolved" : "missing";
    fields.tags = recipe.tags ? "resolved" : "missing";
    fields.source = recipe.source ? "resolved" : "missing";
    fields.image = recipe.image ? "resolved" : "missing";
    fields.notes = recipe.notes ? "resolved" : "missing";

    results.push({ recipe, confidence: buildConfidenceReport(fields, false) });
  }

  return results;
}

function splitRecipeBlocks(html: string): string[] {
  // CopyMeThat puts recipes in <div class="recipe-details"> blocks
  const pattern = /<div[^>]*class="[^"]*recipe[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*recipe[^"]*"|$)/gi;
  const blocks: string[] = [];
  let match;
  while ((match = pattern.exec(html)) !== null) {
    blocks.push(match[0]);
  }
  // Fallback: if no recipe divs found, try splitting by <h2> tags
  if (blocks.length === 0) {
    const h2Pattern = /(<h2[\s\S]*?)(?=<h2|$)/gi;
    while ((match = h2Pattern.exec(html)) !== null) {
      blocks.push(match[1]);
    }
  }
  // Final fallback: treat whole HTML as one recipe
  if (blocks.length === 0 && html.trim().length > 0) {
    blocks.push(html);
  }
  return blocks;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
}

function extractRecipeFromBlock(block: string): Recipe | null {
  // Extract title from <h2> or first heading
  const titleMatch = block.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
  const title = titleMatch ? stripHtml(titleMatch[1]) : null;
  if (!title) return null;

  const recipe: Recipe = { title, ingredientGroups: [], steps: [] };

  // Extract image
  const imgMatch = block.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
  if (imgMatch) recipe.image = imgMatch[1];

  // Extract source URL
  const sourceMatch = block.match(/(?:source|url|from)[:\s]*<a[^>]+href="([^"]+)"[^>]*>/i);
  if (sourceMatch) recipe.source = sourceMatch[1];

  // Extract ingredients — look for a list after "ingredients" heading
  const ingSection = block.match(/ingredients[\s\S]*?(<(?:ul|ol)[^>]*>[\s\S]*?<\/(?:ul|ol)>)/i);
  if (ingSection) {
    const items: string[] = [];
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liPattern.exec(ingSection[1])) !== null) {
      const text = stripHtml(liMatch[1]);
      if (text) items.push(text);
    }
    if (items.length > 0) {
      recipe.ingredientGroups = [{ ingredients: items.map((l) => parseIngredientLine(l)) }];
    }
  }

  // Extract directions/method
  const dirSection = block.match(/(?:directions|instructions|method|steps)[\s\S]*?(<(?:ul|ol)[^>]*>[\s\S]*?<\/(?:ul|ol)>)/i);
  if (dirSection) {
    const steps: string[] = [];
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liPattern.exec(dirSection[1])) !== null) {
      const text = stripHtml(liMatch[1]);
      if (text) steps.push(text);
    }
    recipe.steps = steps.map((s, i) => ({
      number: i + 1,
      paragraphs: [s.replace(/^\d+\.\s*/, "")],
    }));
  }

  // Extract categories/tags
  const catMatch = block.match(/(?:categories?|tags?)[:\s]*([\s\S]*?)(?:<\/|$)/i);
  if (catMatch) {
    const tagText = stripHtml(catMatch[1]);
    const tags = tagText.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
    if (tags.length > 0) recipe.tags = tags;
  }

  return recipe;
}
