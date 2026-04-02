import type { ParseResult, Recipe, Ingredient, IngredientGroup, MethodStep, ConfidenceLevel } from "../types.js";
import { buildConfidenceReport } from "./confidence.js";

// Cooklang inline syntax patterns
const INGREDIENT_RE = /@([^@#~{}]+?)\{([^}]*)\}|@(\w+)/g;
const TIMER_RE = /~([^@#~{}]*?)?\{([^}]*)\}/g;
const COOKWARE_RE = /#([^@#~{}]+?)(?:\{([^}]*)\})?(?=\s|$|[.,;:!?)])/g;
const METADATA_RE = /^>>\s*(.+?):\s*(.+)$/;
const COMMENT_RE = /^\s*--.*$/;
const BLOCK_COMMENT_START = /\[-/;
const BLOCK_COMMENT_END = /-\]/;

/**
 * Parse a Cooklang .cook file into a plainfare Recipe.
 *
 * Cooklang annotates ingredients inline in method steps, so we extract
 * ingredients from the method text and build both the ingredient list
 * and cleaned method steps.
 */
export function parseCooklang(source: string): ParseResult {
  const fields: Partial<Record<keyof Recipe, ConfidenceLevel>> = {};
  const recipe: Recipe = {
    title: "",
    ingredientGroups: [],
    steps: [],
  };

  const lines = source.split("\n");
  const metadata = new Map<string, string>();
  const stepTexts: string[] = [];
  const allIngredients: Ingredient[] = [];
  const seen = new Set<string>();
  let inBlockComment = false;

  for (const line of lines) {
    // Block comments
    if (BLOCK_COMMENT_START.test(line)) {
      inBlockComment = true;
      continue;
    }
    if (inBlockComment) {
      if (BLOCK_COMMENT_END.test(line)) inBlockComment = false;
      continue;
    }

    // Line comments
    if (COMMENT_RE.test(line)) continue;

    // Metadata
    const metaMatch = METADATA_RE.exec(line);
    if (metaMatch) {
      metadata.set(metaMatch[1].trim().toLowerCase(), metaMatch[2].trim());
      continue;
    }

    // Blank lines are step separators in Cooklang
    const trimmed = line.trim();
    if (trimmed === "") continue;

    // This is a step line — extract ingredients and clean the text
    const ingredients = extractInlineIngredients(trimmed);
    for (const ing of ingredients) {
      const key = `${ing.name}|${ing.unit ?? ""}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        allIngredients.push(ing);
      }
    }

    const cleanText = cleanStepText(trimmed);
    if (cleanText) stepTexts.push(cleanText);
  }

  // Title from metadata or filename hint
  if (metadata.has("title")) {
    recipe.title = metadata.get("title")!;
    fields.title = "resolved";
  } else {
    fields.title = "missing";
  }

  // Description
  if (metadata.has("description")) {
    recipe.description = metadata.get("description")!;
    fields.description = "resolved";
  } else {
    fields.description = "missing";
  }

  // Source
  if (metadata.has("source")) {
    recipe.source = metadata.get("source")!;
    fields.source = "resolved";
  } else {
    fields.source = "missing";
  }

  // Tags
  if (metadata.has("tags")) {
    const rawTags = metadata.get("tags")!.split(",").map((t) => t.toLowerCase().trim()).filter(Boolean);
    const seen = new Set<string>();
    recipe.tags = rawTags.filter((t) => { if (seen.has(t)) return false; seen.add(t); return true; });
    fields.tags = "resolved";
  } else {
    fields.tags = "missing";
  }

  // Serves
  if (metadata.has("servings") || metadata.has("serves")) {
    recipe.serves = metadata.get("servings") ?? metadata.get("serves")!;
    fields.serves = "resolved";
  } else {
    fields.serves = "missing";
  }

  // Time
  if (metadata.has("prep time") || metadata.has("cook time") || metadata.has("time")) {
    recipe.time = {};
    const prepStr = metadata.get("prep time");
    const cookStr = metadata.get("cook time");
    if (prepStr) recipe.time.prep = parseMinutes(prepStr);
    if (cookStr) recipe.time.cook = parseMinutes(cookStr);
    if (metadata.has("time") && !prepStr && !cookStr) {
      recipe.time.cook = parseMinutes(metadata.get("time")!);
    }
    fields.time = "resolved";
  } else {
    fields.time = "missing";
  }

  // Ingredients
  if (allIngredients.length > 0) {
    recipe.ingredientGroups = [{ ingredients: allIngredients }];
    fields.ingredientGroups = "resolved";
  } else {
    fields.ingredientGroups = "missing";
  }

  // Steps
  if (stepTexts.length > 0) {
    recipe.steps = stepTexts.map((text, i) => ({
      number: i + 1,
      paragraphs: [text],
    }));
    fields.steps = "resolved";
  } else {
    fields.steps = "missing";
  }

  fields.image = "missing";
  fields.nutrition = "missing";
  fields.notes = "missing";

  return {
    recipe,
    confidence: buildConfidenceReport(fields, false),
  };
}

/** Extract ingredients from Cooklang inline syntax in a step line. */
function extractInlineIngredients(text: string): Ingredient[] {
  const ingredients: Ingredient[] = [];
  let match: RegExpExecArray | null;

  INGREDIENT_RE.lastIndex = 0;
  while ((match = INGREDIENT_RE.exec(text)) !== null) {
    // match[1]+match[2] = @name{spec} form, match[3] = @word form (no braces)
    const name = (match[1] ?? match[3]).trim();
    const spec = match[2]; // "quantity%unit" or "quantity" or "" or undefined

    if (spec != null && spec !== "") {
      const parts = spec.split("%");
      const qtyStr = parts[0].trim();
      const unit = parts[1]?.trim();
      const quantity = parseQuantity(qtyStr);

      ingredients.push({
        name,
        ...(quantity != null && { quantity }),
        ...(unit && { unit }),
      });
    } else {
      ingredients.push({ name });
    }
  }

  return ingredients;
}

/** Remove Cooklang syntax markers from step text, leaving natural prose. */
function cleanStepText(text: string): string {
  return text
    // @ingredient{qty%unit} → ingredient
    .replace(/@([^@#~{}]+?)\{[^}]*\}/g, "$1")
    // @ingredient (no braces, single word) → ingredient
    .replace(/@(\w+)/g, "$1")
    // #cookware{qty} → cookware
    .replace(/#([^@#~{}]+?)\{[^}]*\}/g, "$1")
    // #cookware (no braces, single word) → cookware
    .replace(/#(\w+)/g, "$1")
    // ~name{time%unit} → time unit
    .replace(/~(?:[^@#~{}]*?)?\{([^}]*)\}/g, (_, spec) => {
      const parts = spec.split("%");
      return `${parts[0]}${parts[1] ? " " + parts[1] : ""}`;
    })
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseQuantity(str: string): number | undefined {
  if (!str) return undefined;
  // Handle fractions: "1/2", "3/4"
  const fracMatch = /^(\d+)\/(\d+)$/.exec(str);
  if (fracMatch) return parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
  // Handle mixed: "1 1/2"
  const mixedMatch = /^(\d+)\s+(\d+)\/(\d+)$/.exec(str);
  if (mixedMatch) return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
  const n = parseFloat(str);
  return isNaN(n) ? undefined : n;
}

function parseMinutes(str: string): number | undefined {
  const match = /(\d+)\s*(?:min|m\b)/i.exec(str);
  if (match) return parseInt(match[1]);
  const hrMatch = /(\d+)\s*(?:hour|hr|h\b)/i.exec(str);
  if (hrMatch) return parseInt(hrMatch[1]) * 60;
  const n = parseInt(str);
  return isNaN(n) ? undefined : n;
}
