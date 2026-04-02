import type { ParseResult, Recipe, Nutrition, ConfidenceLevel } from "../types.js";
import { buildConfidenceReport } from "./confidence.js";

/**
 * Interface for AI providers that can extract recipes from various inputs.
 * The web service provides the concrete implementation; core defines the contract.
 * Each extraction type has its own method — they have different API call shapes
 * (vision messages vs plain text) so a single generic method would push branching
 * into every provider.
 */
export interface AiProvider {
  /** Send an image to a vision-capable LLM and get back raw JSON text */
  extractRecipeFromImage(image: Uint8Array, mimeType: string): Promise<string>;
  /** Send plain text (pasted recipe, transcript, etc.) to an LLM and get back raw JSON text */
  extractRecipeFromText(text: string): Promise<string>;
  /** Send an ingredient list and get back estimated nutrition JSON text */
  estimateNutrition(ingredientText: string): Promise<string>;
}

/** Shared JSON schema for all extraction prompts — keeps Recipe type and prompt in sync */
function recipeJsonSchema(): string {
  return `{
  "title": "string (required)",
  "description": "string or null",
  "image": "string or null (URL if visible)",
  "source": "string or null (URL or attribution if visible)",
  "tags": ["string"] or null,
  "serves": "string or null (e.g. "4", "6-8", "12 cookies")",
  "time": { "prep": number_or_null, "cook": number_or_null } or null (in minutes),
  "nutrition": {
    "calories": number_or_null,
    "protein": number_or_null,
    "carbs": number_or_null,
    "fat": number_or_null,
    "fibre": number_or_null
  } or null,
  "ingredientGroups": [
    {
      "title": "string or null (group name like "Sauce", "Dough")",
      "ingredients": [
        {
          "quantity": number_or_null,
          "unit": "string or null (e.g. "g", "cups", "tbsp")",
          "name": "string (required)",
          "note": "string or null (e.g. "finely grated", "to taste")"
        }
      ]
    }
  ],
  "steps": [
    {
      "number": 1,
      "paragraphs": ["string"]
    }
  ],
  "notes": "string or null"
}`;
}

/** Shared extraction rules appended to all prompts */
function extractionRules(): string {
  return `Rules:
- Use metric units where possible, but preserve the original if clearly imperial
- If a field is not visible or cannot be determined, use null
- For ingredients without a quantity (e.g. "salt to taste"), set quantity to null and put "to taste" in the note field
- Number method steps sequentially starting from 1
- If ingredients are grouped (e.g. "For the sauce:"), use the group title; otherwise use a single group with title null`;
}

/**
 * Build the system prompt for image-based recipe extraction.
 * This lives in core so the prompt stays in sync with the Recipe type.
 */
export function buildImageExtractionPrompt(): string {
  return `You are a recipe extraction assistant. Extract the recipe from the provided image and return it as a JSON object.

Return ONLY valid JSON with no markdown formatting, no code fences, no explanation. The JSON must conform to this schema:

${recipeJsonSchema()}

${extractionRules()}
- Extract all visible information from the image`;
}

/**
 * Build the system prompt for text-based recipe extraction.
 * Used when a user pastes raw recipe text, a transcript, or other unstructured content.
 */
export function buildTextExtractionPrompt(): string {
  return `You are a recipe extraction assistant. Parse the provided recipe text and return it as a JSON object.

Return ONLY valid JSON with no markdown formatting, no code fences, no explanation. The JSON must conform to this schema:

${recipeJsonSchema()}

${extractionRules()}
- Extract all information present in the text
- Infer reasonable tags from the recipe content if not explicitly listed`;
}

/**
 * Parse a raw AI JSON response into a ParseResult.
 * All fields are marked as "inferred" since they came from AI extraction.
 */
export function parseAiRecipeResponse(response: string): ParseResult {
  // Strip markdown code fences if the LLM included them despite instructions
  let cleaned = response.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  const raw = JSON.parse(cleaned);

  const recipe: Recipe = {
    title: raw.title || "Untitled Recipe",
    ingredientGroups: [],
    steps: [],
  };

  if (raw.description) recipe.description = raw.description;
  if (raw.image) recipe.image = raw.image;
  if (raw.source) recipe.source = raw.source;
  if (raw.tags && Array.isArray(raw.tags)) {
    const seen = new Set<string>();
    recipe.tags = (raw.tags as string[])
      .map((t) => String(t).toLowerCase().trim())
      .filter((t) => {
        if (!t || seen.has(t)) return false;
        seen.add(t);
        return true;
      });
  }
  if (raw.serves) recipe.serves = String(raw.serves);

  if (raw.time) {
    recipe.time = {};
    if (raw.time.prep != null) recipe.time.prep = raw.time.prep;
    if (raw.time.cook != null) recipe.time.cook = raw.time.cook;
  }

  if (raw.nutrition) {
    recipe.nutrition = {};
    if (raw.nutrition.calories != null) recipe.nutrition.calories = raw.nutrition.calories;
    if (raw.nutrition.protein != null) recipe.nutrition.protein = raw.nutrition.protein;
    if (raw.nutrition.carbs != null) recipe.nutrition.carbs = raw.nutrition.carbs;
    if (raw.nutrition.fat != null) recipe.nutrition.fat = raw.nutrition.fat;
    if (raw.nutrition.fibre != null) recipe.nutrition.fibre = raw.nutrition.fibre;
  }

  if (raw.ingredientGroups && Array.isArray(raw.ingredientGroups)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recipe.ingredientGroups = raw.ingredientGroups.map((g: any) => {
      const group: { title?: string; ingredients: { quantity?: number; unit?: string; name: string; note?: string }[] } = {
        ingredients: [],
      };
      if (g.title) group.title = String(g.title);
      if (Array.isArray(g.ingredients)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        group.ingredients = g.ingredients.map((i: any) => {
          const ing: { quantity?: number; unit?: string; name: string; note?: string } = {
            name: String(i.name || ""),
          };
          if (i.quantity != null) ing.quantity = Number(i.quantity);
          if (i.unit) ing.unit = String(i.unit);
          if (i.note) ing.note = String(i.note);
          return ing;
        });
      }
      return group;
    });
  }

  if (raw.notes) recipe.notes = String(raw.notes);

  if (raw.steps && Array.isArray(raw.steps)) {
    recipe.steps = raw.steps.map((s: Record<string, unknown>, idx: number) => ({
      number: s.number != null ? Number(s.number) : idx + 1,
      paragraphs: Array.isArray(s.paragraphs)
        ? (s.paragraphs as string[])
        : [String(s.text || s.paragraphs || "")],
    }));
  }

  // All AI-extracted fields are "inferred"
  const fields: Partial<Record<keyof Recipe, ConfidenceLevel>> = {};
  fields.title = recipe.title ? "inferred" : "missing";
  fields.description = recipe.description ? "inferred" : "missing";
  fields.image = recipe.image ? "inferred" : "missing";
  fields.source = recipe.source ? "inferred" : "missing";
  fields.tags = recipe.tags ? "inferred" : "missing";
  fields.serves = recipe.serves ? "inferred" : "missing";
  fields.time = recipe.time ? "inferred" : "missing";
  fields.nutrition = recipe.nutrition ? "inferred" : "missing";
  fields.ingredientGroups = recipe.ingredientGroups.length > 0 ? "inferred" : "missing";
  fields.steps = recipe.steps.length > 0 ? "inferred" : "missing";
  fields.notes = recipe.notes ? "inferred" : "missing";

  return {
    recipe,
    confidence: buildConfidenceReport(fields, true),
  };
}

/**
 * Build the system prompt for nutrition estimation from an ingredient list.
 */
export function buildNutritionEstimationPrompt(): string {
  return `You are a nutrition estimation assistant. Given a list of recipe ingredients, estimate the total nutritional information for the entire recipe.

Return ONLY valid JSON with no markdown formatting, no code fences, no explanation. The JSON must conform to this schema:

{
  "calories": number (total kcal for the whole recipe),
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams),
  "fibre": number (grams)
}

Rules:
- Estimate based on standard nutritional databases (e.g. USDA)
- If a quantity is missing (e.g. "salt to taste"), use a typical amount
- Round values to the nearest whole number
- Return the total for the entire recipe, not per serving`;
}

/**
 * Parse a raw AI JSON response into a Nutrition object.
 * Returns null if the response cannot be parsed.
 */
export function parseNutritionResponse(response: string): Nutrition | null {
  let cleaned = response.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  try {
    const raw = JSON.parse(cleaned);
    const nutrition: Nutrition = {};
    if (raw.calories != null) nutrition.calories = Math.round(Number(raw.calories));
    if (raw.protein != null) nutrition.protein = Math.round(Number(raw.protein));
    if (raw.carbs != null) nutrition.carbs = Math.round(Number(raw.carbs));
    if (raw.fat != null) nutrition.fat = Math.round(Number(raw.fat));
    if (raw.fibre != null) nutrition.fibre = Math.round(Number(raw.fibre));
    // Return null if no fields were populated
    if (Object.keys(nutrition).length === 0) return null;
    return nutrition;
  } catch {
    return null;
  }
}
