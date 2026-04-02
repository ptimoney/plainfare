import { unzipSync, gunzipSync } from "fflate";
import type { ParseResult, Recipe, Nutrition } from "../types.js";
import { parseIngredientLine } from "./ingredient.js";
import { buildConfidenceReport } from "./confidence.js";
import type { ConfidenceLevel } from "../types.js";

interface PaprikaRecipe {
  name?: string;
  ingredients?: string;
  directions?: string;
  categories?: string[];
  source?: string;
  source_url?: string;
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  nutritional_info?: string;
  notes?: string;
  image_url?: string;
  description?: string;
  difficulty?: string;
  rating?: number;
  photo_data?: string;
}

function parseTimeMinutes(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  // "30 minutes", "1 hour 15 minutes", "1h 30m", "45 min", "1:30"
  const colonMatch = raw.match(/^(\d+):(\d+)$/);
  if (colonMatch) return parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);

  let total = 0;
  const hourMatch = raw.match(/(\d+)\s*h(?:ours?)?/i);
  const minMatch = raw.match(/(\d+)\s*m(?:in(?:utes?)?)?/i);
  if (hourMatch) total += parseInt(hourMatch[1]) * 60;
  if (minMatch) total += parseInt(minMatch[1]);
  if (total > 0) return total;

  // Plain number — assume minutes
  const plain = parseInt(raw);
  return isNaN(plain) ? undefined : plain;
}

function parseNutritionalInfo(raw: string | undefined): Nutrition | undefined {
  if (!raw) return undefined;
  const nutrition: Nutrition = {};
  const cal = raw.match(/(\d+)\s*(?:cal(?:ories?)?|kcal)/i);
  if (cal) nutrition.calories = parseInt(cal[1]);
  const protein = raw.match(/(\d+)\s*g?\s*protein/i);
  if (protein) nutrition.protein = parseInt(protein[1]);
  const carbs = raw.match(/(\d+)\s*g?\s*carb(?:s|ohydrates?)?/i);
  if (carbs) nutrition.carbs = parseInt(carbs[1]);
  const fat = raw.match(/(\d+)\s*g?\s*fat/i);
  if (fat) nutrition.fat = parseInt(fat[1]);
  const fibre = raw.match(/(\d+)\s*g?\s*fib(?:re|er)/i);
  if (fibre) nutrition.fibre = parseInt(fibre[1]);
  return Object.keys(nutrition).length > 0 ? nutrition : undefined;
}

function paprikaToRecipe(raw: PaprikaRecipe): Recipe {
  const recipe: Recipe = {
    title: raw.name || "Untitled Recipe",
    ingredientGroups: [],
    steps: [],
  };

  if (raw.description) recipe.description = raw.description;
  if (raw.image_url) recipe.image = raw.image_url;
  if (raw.source_url) recipe.source = raw.source_url;
  else if (raw.source) recipe.source = raw.source;
  if (raw.categories && raw.categories.length > 0) recipe.tags = raw.categories;
  if (raw.servings) recipe.serves = raw.servings;

  const prep = parseTimeMinutes(raw.prep_time);
  const cook = parseTimeMinutes(raw.cook_time);
  if (prep != null || cook != null) {
    recipe.time = {};
    if (prep != null) recipe.time.prep = prep;
    if (cook != null) recipe.time.cook = cook;
  }

  const nutrition = parseNutritionalInfo(raw.nutritional_info);
  if (nutrition) recipe.nutrition = nutrition;

  // Ingredients — one per line
  if (raw.ingredients) {
    const lines = raw.ingredients
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    recipe.ingredientGroups = [
      { ingredients: lines.map((l) => parseIngredientLine(l)) },
    ];
  }

  // Steps — split on double newline or numbered prefixes
  if (raw.directions) {
    const paragraphs = raw.directions
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    recipe.steps = paragraphs.map((p, i) => ({
      number: i + 1,
      paragraphs: [p.replace(/^\d+\.\s*/, "")],
    }));
  }

  if (raw.notes) recipe.notes = raw.notes;

  return recipe;
}

/**
 * Parse a Paprika `.paprikarecipes` archive.
 * Format: zip of individually gzipped JSON files.
 */
export function parsePaprikaArchive(buffer: Uint8Array): ParseResult[] {
  const zipEntries = unzipSync(buffer);
  const results: ParseResult[] = [];

  for (const [, compressed] of Object.entries(zipEntries)) {
    try {
      const decompressed = gunzipSync(compressed);
      const text = new TextDecoder().decode(decompressed);
      const raw: PaprikaRecipe = JSON.parse(text);
      const recipe = paprikaToRecipe(raw);

      const fields: Partial<Record<keyof Recipe, ConfidenceLevel>> = {};
      fields.title = recipe.title !== "Untitled Recipe" ? "resolved" : "missing";
      fields.ingredientGroups = recipe.ingredientGroups.length > 0 ? "resolved" : "missing";
      fields.steps = recipe.steps.length > 0 ? "resolved" : "missing";
      fields.description = recipe.description ? "resolved" : "missing";
      fields.tags = recipe.tags ? "resolved" : "missing";
      fields.serves = recipe.serves ? "resolved" : "missing";
      fields.time = recipe.time ? "resolved" : "missing";
      fields.nutrition = recipe.nutrition ? "resolved" : "missing";
      fields.source = recipe.source ? "resolved" : "missing";
      fields.image = recipe.image ? "resolved" : "missing";
      fields.notes = recipe.notes ? "resolved" : "missing";

      results.push({ recipe, confidence: buildConfidenceReport(fields, false) });
    } catch {
      // Skip entries that fail to parse
    }
  }

  return results;
}
