import type { ParseResult, Recipe, ConfidenceLevel } from "../types.js";
import { buildConfidenceReport } from "./confidence.js";

/**
 * Interface for AI providers that can extract recipes from various inputs.
 * The web service provides the concrete implementation; core defines the contract.
 */
export interface AiProvider {
  /** Send an image to a vision-capable LLM and get back raw JSON text */
  extractRecipeFromImage(image: Uint8Array, mimeType: string): Promise<string>;
}

/**
 * Build the system prompt for image-based recipe extraction.
 * This lives in core so the prompt stays in sync with the Recipe type.
 */
export function buildImageExtractionPrompt(): string {
  return `You are a recipe extraction assistant. Extract the recipe from the provided image and return it as a JSON object.

Return ONLY valid JSON with no markdown formatting, no code fences, no explanation. The JSON must conform to this schema:

{
  "title": "string (required)",
  "description": "string or null",
  "image": "string or null (URL if visible)",
  "source": "string or null (URL or attribution if visible)",
  "tags": ["string"] or null,
  "serves": "string or null (e.g. \"4\", \"6-8\", \"12 cookies\")",
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
      "title": "string or null (group name like \"Sauce\", \"Dough\")",
      "ingredients": [
        {
          "quantity": number_or_null,
          "unit": "string or null (e.g. \"g\", \"cups\", \"tbsp\")",
          "name": "string (required)",
          "note": "string or null (e.g. \"finely grated\", \"to taste\")"
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
}

Rules:
- Extract all visible information from the image
- Use metric units where possible, but preserve the original if clearly imperial
- If a field is not visible or cannot be determined, use null
- For ingredients without a quantity (e.g. "salt to taste"), set quantity to null and put "to taste" in the note field
- Number method steps sequentially starting from 1
- If ingredients are grouped (e.g. "For the sauce:"), use the group title; otherwise use a single group with title null`;
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
  if (raw.tags && Array.isArray(raw.tags)) recipe.tags = raw.tags;
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
